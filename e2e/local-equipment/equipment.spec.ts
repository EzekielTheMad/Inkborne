import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
test("real builder and atomic equipment caller recover offline at desktop/mobile sizes", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-builder-local.mjs"], { cwd: process.cwd(), windowsHide: true });
  let output = "";
  child.stdout.on("data", chunk => { output += String(chunk); });
  child.stderr.on("data", chunk => { output += String(chunk); });
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    console.log(output);
    expect(code, output).toBe(0);
    const evidence = JSON.parse(await readFile("test-results/builder-local/evidence.json", "utf8"));
    expect(evidence.liveSupabase).toBe(false);
    expect(evidence.pageErrors).toEqual([]);
    expect(evidence.blockedRemoteRequests).toEqual([]);
    expect(evidence.evidence.some((row: { check?: string }) => row.check?.includes("explicit mobile recovery"))).toBe(true);
  } finally {
    if (child.exitCode === null) child.kill();
  }
});
