import { execFileSync, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import assert from "node:assert/strict";
import { freshMagicAckProof, magicAckSha, verifyMagicAckHelpers } from "../../scripts/magic-ack-inputs.mjs";

const entryProof = await verifyMagicAckHelpers(process.cwd());
const { expect, test } = await import("@playwright/test");

test("actual magic-item form with complete rendered proof and private cleanup", async () => {
  const root = process.cwd(), script = path.resolve("scripts/verify-magic-ack-local.mjs"), outputDirectory = "test-results/magic-ack-local";
  const firstProof = await verifyMagicAckHelpers(root); assert.deepEqual(firstProof, entryProof); // Builtins-only BEFORE inherited import/use.
  const { npcOsIdentity } = await import("../../scripts/npc-process.mjs");
  const workerIdentity = { ...npcOsIdentity(process.pid, process.ppid), cwd: root, port: null, startedUtc: new Date().toISOString() };
  console.log(JSON.stringify({ workerIdentity }));
  const child = spawn(process.execPath, [script], { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"] });
  let output = "", rendered, reportedResources, forced = false;
  child.stdout.on("data", chunk => { output += String(chunk); }); child.stderr.on("data", chunk => { output += String(chunk); });
  child.on("message", message => {
    const incoming = message;
    if (incoming.type === "rendered-proof") { assert.equal(rendered, undefined, "Only one initial rendered proof allowed"); rendered = incoming.initialBindings; }
    if (incoming.type === "resources") {
      if (reportedResources?.browserProcess) assert.deepEqual(reportedResources.browserProcess, incoming.browserProcess);
      reportedResources = { taskProcess: incoming.taskProcess, browserProcess: incoming.browserProcess };
    }
  });
  const completion = new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  let identity;
  async function rebindRenderedProof() {
    assert.ok(rendered, "Refuse cleanup/acceptance without the initially captured IPC rendered envelope");
    assert.deepEqual(await verifyMagicAckHelpers(root), firstProof);
    const disk = JSON.parse(await readFile(`${outputDirectory}/initial-rendered-proof.json`, "utf8")); assert.deepEqual(disk, rendered);
    const metafile = JSON.parse(await readFile(`${outputDirectory}/bundle-metafile.json`, "utf8"));
    const entries = JSON.parse(await readFile(`${outputDirectory}/captured-inputs.json`, "utf8"));
    assert.equal(magicAckSha(JSON.stringify(entries)), rendered.artifacts.capturedInputsSha256);
    assert.equal(magicAckSha(JSON.stringify(metafile)), rendered.artifacts.metafileSha256);
    const fresh = await freshMagicAckProof(root, rendered.artifacts.manifestPath, metafile, new Map(entries), rendered.artifacts);
    assert.deepEqual(fresh, rendered.artifacts); return fresh;
  }
  try {
    expect(child.pid).toBeDefined();
    try { identity = npcOsIdentity(child.pid, process.pid); } catch { expect(child.exitCode, "Refuse unidentified live cleanup").not.toBeNull(); }
    if (identity) expect(identity.command).toContain(script);
    const code = await completion; console.log(output); expect(code, output).toBe(0);
    const result = JSON.parse(await readFile(`${outputDirectory}/evidence.json`, "utf8"));
    expect(result.liveSupabase).toBe(false); expect(result.providerWrites).toBe(false); expect(result.persistence).toBe("unavailable"); expect(result.simulatedAuth).toBe(true);
    expect(result.artifacts.magicAckSourceCheckpoint).toBe("6aa858ac57fe518c236e5baa2497ce425c47839e");
    expect(result.initialBindings).toEqual(rendered); expect(result.initialBindings.artifacts).toEqual(result.artifacts);
    expect(result.finalBindings.matchedRenderedProof).toBe(true); expect(result.finalBindings.artifacts).toEqual(result.artifacts);
    await rebindRenderedProof();
    expect(result.artifacts.sourceCommit).toBe(result.artifacts.currentRootHead);
    expect(result.artifacts.harnessFiles).toHaveLength(6); expect(result.artifacts.magicSourceFiles).toHaveLength(8); expect(result.artifacts.magicHelperDependencies).toHaveLength(2);
    expect(result.artifacts.installedRuntime.packages).toHaveLength(9); expect(result.artifacts.installedRuntime.nodeExecutable.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artifacts.dependencyLockSha256).toMatch(/^[a-f0-9]{64}$/); expect(result.artifacts.fixtureBundleSha256).toMatch(/^[a-f0-9]{64}$/);
    for (const item of result.artifacts.magicHelperDependencies) expect(item.expected).toBe(item.relativePath === "scripts/npc-process.mjs" ? "0841bda7b9e785280e684030bf4fe900d81465e5" : "e4058f8a31cd911583a312e59fedcf4c3fd4adae");
    for (const required of ["components/library/magic-item-form.tsx", "lib/homebrew/magic-item-form.ts", "lib/schemas/content-types/magic-item.ts", "lib/schemas/effects.ts", "lib/schemas/content.ts", "lib/supabase/content-definitions-parser.ts"])
      expect(result.artifacts.bundledProjectInputs.some(input => input.relativePath === required)).toBe(true);
    expect(result.artifacts.bundledRuntimeInputs.some(input => input.relativePath.endsWith("/unstable-rethrow.browser.js"))).toBe(true);
    expect(result.taskProcess.birthUtc).toBe(identity?.birthUtc); expect(result.browserProcess.birthUtc).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(result.evidence).toHaveLength(34); expect(result.evidence.every(entry => entry.passed)).toBe(true);
    expect(result.screenshots).toHaveLength(36); expect(new Set(result.screenshots).size).toBe(36); expect(result.fontEvidence).toHaveLength(36);
    expect(result.artifacts.fontClassProof).toHaveLength(2);
    expect(result.fontEvidence.every(sample => sample.fonts.length === 3 && sample.fonts.every(font => font.family && font.statuses.every(status => status === "loaded")))).toBe(true);
    expect(result.assetRequests.some(asset => /\.woff2?$/.test(asset.path) && /^[a-f0-9]{64}$/.test(asset.sha256))).toBe(true);
    expect(result.pageErrors).toEqual([]); expect(result.diagnostics).toEqual([]); expect(result.blockedRequests).toEqual([]); expect(result.unexpectedRequests).toEqual([]);
    expect(result.failure).toBeNull(); expect(result.portClosed).toBe(true); expect(result.browserPortClosed).toBe(true); expect(result.browserExited).toBe(true);
  } finally {
    if (child.exitCode === null) {
      if (child.connected) child.send({ type: "stop" }, () => {});
      const ended = await new Promise(resolve => {
        const timer = setTimeout(() => resolve(false), 10_000);
        child.once("exit", () => { clearTimeout(timer); resolve(true); });
        if (child.exitCode !== null) { clearTimeout(timer); resolve(true); }
      });
      if (!ended && child.exitCode === null) {
        expect(identity, "Refuse forced cleanup without original OS birth/PID/parent/command").toBeDefined();
        await rebindRenderedProof(); // Whole fresh root/build/assets/fonts/runtime/transitive proof, not helpers only.
        if (child.exitCode === null) {
          const fresh = npcOsIdentity(identity.pid, identity.parentPid);
          expect(fresh.birthUtc).toBe(identity.birthUtc); expect(fresh.command).toBe(identity.command); expect(fresh.command).toContain(script);
          execFileSync("taskkill", ["/pid", String(identity.pid), "/T", "/F"], { windowsHide: true });
          forced = true;
        }
      }
    }
    assert.deepEqual(await verifyMagicAckHelpers(root), firstProof);
    if (reportedResources) {
      const closed = port => port ? new Promise(resolve => {
        const socket = net.connect({ host: "127.0.0.1", port }); socket.setTimeout(2000, () => { socket.destroy(); resolve(false); });
        socket.once("connect", () => { socket.destroy(); resolve(false); }); socket.once("error", error => resolve(error.code === "ECONNREFUSED"));
      }) : Promise.resolve(true);
      const portClosed = await closed(reportedResources.taskProcess.listeningPort), browserPortClosed = await closed(reportedResources.browserProcess?.listeningPort);
      const remaining = [];
      for (const original of [reportedResources.taskProcess, reportedResources.browserProcess].filter(Boolean)) {
        assert.ok(Number.isSafeInteger(original.pid) && original.pid > 0); assert.match(original.birthUtc, /^\d{4}-\d{2}-\d{2}T.*Z$/);
        const text = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${original.pid}';if($p){@{pid=$p.ProcessId;parentPid=$p.ParentProcessId;birthUtc=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress}else{'null'}`], { encoding: "utf8", windowsHide: true });
        const fresh = JSON.parse(text); if (fresh?.birthUtc === original.birthUtc && fresh.parentPid === original.parentPid) remaining.push(fresh);
      }
      await writeFile(`${outputDirectory}/wrapper-cleanup.json`, JSON.stringify({ forced, identity, reportedResources, portClosed, browserPortClosed, remaining }, null, 2));
      expect(portClosed).toBe(true); expect(browserPortClosed).toBe(true); expect(remaining).toEqual([]);
    }
  }
});
