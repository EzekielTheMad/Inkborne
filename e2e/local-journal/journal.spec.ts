import { test, expect, chromium } from "@playwright/test";
import { build } from "esbuild";
import { createServer, type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// The real TimelineSection and TipTap editor; only server actions/persistence are simulated.
const fixture = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TimelineSection} from '@/components/narrative/timeline-section';
window.journalFixture = {mode:'success',calls:0};
function App() {
  const [events,setEvents] = useState(JSON.parse(sessionStorage.getItem('journal-fixture') || '[]'));
  const [owner,setOwner] = useState(true);
  window.journalFixture.save = (characterId,id,input) => {
    window.journalFixture.calls++;
    if(window.journalFixture.mode === 'denied') return {status:'rejected',code:'not_authorized',error:'Not authorized'};
    const row = {id:id||input.entryId,character_id:characterId,created_by:'synthetic-owner',
      title:input.title,date_label:input.dateLabel,description:input.description,visibility:input.visibility,
      sort_order:input.sortOrder,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const next = id ? events.map(event => event.id === id ? {...event,...row} : event) : [...events,row];
    sessionStorage.setItem('journal-fixture',JSON.stringify(next));
    if(window.journalFixture.mode === 'lost') throw Error('Simulated committed response loss');
    setEvents(next); return {status:'saved',entryId:row.id,updatedAt:row.updated_at};
  };
  window.journalFixture.read = id => {const rows=JSON.parse(sessionStorage.getItem('journal-fixture')||'[]');setEvents(rows);const entry=rows.find(row=>row.id===id);return entry?{status:'found',entry}:{status:'absent'};};
  return <main style={{maxWidth:900,margin:'auto',padding:16}}>
    <p>Offline journal; simulated persistence and permissions. No account or database.</p>
    <button onClick={()=>setOwner(!owner)}>Toggle viewer</button>
    <TimelineSection characterId='synthetic-character' events={events} isOwner={owner}/>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

async function closed(port: number) {
  return new Promise<boolean>(resolve => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(true));
  });
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`journal create/edit/reopen and failure recovery (${viewport.width}px, simulated)`, async () => {
    const bundle = await build({
      stdin: { contents: fixture, loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [{ name: "offline-story-actions", setup(builder) {
        builder.onResolve({ filter: /story-actions$/ }, () => ({ path: "actions", namespace: "offline" }));
        builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "offline" }));
        builder.onLoad({ filter: /.*/, namespace: "offline" }, ({ path: name }) => ({
          contents: name === "actions"
            ? `export const createTimelineEvent=async(c,i)=>window.journalFixture.save(c,null,i);
               export const updateTimelineEvent=async(c,id,i)=>window.journalFixture.save(c,id,i);
               export const readTimelineEvent=async(c,id)=>window.journalFixture.read(id);
               export const deleteTimelineEvent=async()=>({error:'Not exercised in this fixture'});`
            : `import React from 'react';export default function Link(props){return React.createElement('a',props)}`,
          resolveDir: process.cwd(), loader: "js",
        }));
      } }],
    });
    const from = path.resolve("app/globals.css");
    const css = (await postcss([tailwind({ base: process.cwd() })]).process(await fs.readFile(from, "utf8"), { from })).css;
    const server: Server = createServer((request, response) => {
      if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle.outputFiles[0].text); }
      else if (request.url === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
      else if (request.url === "/") { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/fixture.js"></script>'); }
      else { response.writeHead(404); response.end(); }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw Error("Expected loopback port");
    const port = address.port, origin = `http://127.0.0.1:${port}`;
    console.log(JSON.stringify({ pid: process.pid, parentPid: process.ppid, cwd: process.cwd(), port, started: new Date().toISOString() }));
    let browserServer;
    let controlPort: number | undefined;
    try {
      browserServer = await chromium.launchServer({ headless: true, host: "127.0.0.1",
        ...(process.platform === "win32" ? { channel: "chrome" } : {}),
        args: ["--js-flags=--max-old-space-size=512"],
      });
      controlPort = Number(new URL(browserServer.wsEndpoint()).port);
      console.log(JSON.stringify({ browserPid: browserServer.process().pid, parentPid: process.pid, cwd: process.cwd(), port: controlPort, started: new Date().toISOString() }));
      const browser = await chromium.connect(browserServer.wsEndpoint());
      const context = await browser.newContext({ viewport, acceptDownloads: true });
      await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("dialog", dialog => dialog.dismiss());
      await page.goto(origin);
      await page.getByRole("button", { name: "Write entry" }).click();
      await page.getByLabel("Entry title").fill("River watch");
      await page.getByLabel("When", { exact: true }).fill("Late autumn");
      const editor = page.locator('.tiptap[contenteditable="true"]');
      await editor.fill("The current carried a warning.");
      await expect(page.getByLabel("Audience if assigned to a campaign")).toHaveValue("dm_only");
      await page.getByRole("button", { name: "Save entry", exact: true }).click();
      await expect(page.getByRole("heading", { name: "River watch" })).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: "Edit River watch", exact: true }).click();
      await expect(editor).toContainText("The current carried a warning.");
      await page.getByLabel("Entry title").fill("River answer");
      await editor.fill("We followed it home.");
      await page.getByRole("button", { name: "Save entry", exact: true }).click();
      await page.reload();
      await expect(page.getByRole("heading", { name: "River answer" })).toBeVisible();
      await expect(page.getByText("We followed it home.")).toBeVisible();
      await page.getByRole("button", { name: "Toggle viewer" }).click();
      await expect(page.getByRole("button", { name: "Write entry" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Edit River answer", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Toggle viewer" }).click();
      await page.getByRole("button", { name: "Write entry" }).click();
      await page.getByLabel("Entry title").fill("Kept draft");
      await editor.fill("Do not lose this reflection.");
      await page.evaluate(() => { (window as unknown as {journalFixture:{mode:string}}).journalFixture.mode = "denied"; });
      await page.getByRole("button", { name: "Save entry", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("Not authorized");
      await expect(editor).toContainText("Do not lose this reflection.");
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download draft" }).click();
      const download = await downloadPromise;
      const downloaded = test.info().outputPath("journal-draft.json");
      await download.saveAs(downloaded);
      expect(JSON.parse(await fs.readFile(downloaded, "utf8"))).toMatchObject({ title: "Kept draft", visibility: "dm_only" });
      await page.evaluate(() => { (window as unknown as {journalFixture:{mode:string}}).journalFixture.mode = "lost"; });
      await page.getByRole("button", { name: "Save entry", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("Save status unknown");
      await expect(page.getByRole("button", { name: "Save entry", exact: true })).toBeDisabled();
      await expect(editor).toContainText("Do not lose this reflection.");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath("journal-draft.png"), fullPage: true });
      expect(errors).toEqual([]);
      await context.close();
      await browser.close();
    } finally {
      if (browserServer) await browserServer.close();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      expect(await closed(port)).toBe(true);
      if (controlPort) expect(await closed(controlPort)).toBe(true);
    }
  });
}
