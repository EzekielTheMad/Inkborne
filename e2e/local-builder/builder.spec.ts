import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("builder dropdowns retain eligibility and save recovery in desktop and mobile Chrome", async () => {
  console.log(JSON.stringify({ pid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-builder-local.mjs"], { cwd: process.cwd(), windowsHide: true });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  try {
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    console.log(output);
    expect(code, output).toBe(0);
    const metadata = output.split(/\r?\n/).find(line => line.startsWith('{"builderDropdownOutput":'));
    expect(metadata).toBeTruthy();
    const directory = path.resolve(JSON.parse(metadata!).builderDropdownOutput);
    expect(directory.startsWith(path.resolve("test-results") + path.sep + "builder-local-")).toBe(true);
    const evidence = JSON.parse(await readFile(path.join(directory, "evidence.json"), "utf8"));
    const cleanup = JSON.parse(await readFile(path.join(directory, "cleanup.json"), "utf8"));
    expect(evidence).toMatchObject({ status: "passed", simulated: true, liveSupabase: false, pageErrors: [], blockedRemoteRequests: [] });
    expect(evidence.evidence.length).toBeGreaterThan(15);
    expect(cleanup).toMatchObject({ portClosed: true, browserClosed: true });
  } finally { if (child.exitCode === null) child.kill(); }
});
