import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

test("current campaign, homebrew, spell navigation and ASI selectors offline", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), command: "playwright test --config e2e/local-drift/playwright.config.ts", startTime: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-e2e-drift-local.mjs"], { cwd: process.cwd(), windowsHide: true });
  let output = "";
  child.stdout.on("data", chunk => { output += String(chunk); });
  child.stderr.on("data", chunk => { output += String(chunk); });
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    console.log(output);
    expect(code, output).toBe(0);
    const evidence = JSON.parse(await readFile("test-results/e2e-drift-local/evidence.json", "utf8"));
    expect(evidence.liveSupabase).toBe(false);
    expect(evidence.evidence).toHaveLength(10);
    expect(evidence.pageErrors).toEqual([]);
    expect(evidence.remoteRequests).toEqual([]);
  } finally {
    if (child.exitCode === null) child.kill();
  }
});
