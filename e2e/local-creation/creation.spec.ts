import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

test("actual creation and first-class UI retain originals across reload, retry and account transitions offline", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), observedStartedUtc: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-creation-local.mjs"], { cwd: process.cwd(), windowsHide: true });
  let output = "";
  child.stdout.on("data", chunk => { output += String(chunk); });
  child.stderr.on("data", chunk => { output += String(chunk); });
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    console.log(output); expect(code, output).toBe(0);
    const result = JSON.parse(await readFile("test-results/creation-local/evidence.json", "utf8"));
    expect(result.status).toBe("passed"); expect(result.liveSupabase).toBe(false); expect(result.realNextServer).toBe(false);
    expect(result.pageErrors).toEqual([]); expect(result.blockedRemoteRequests).toEqual([]);
    expect(result.evidence).toHaveLength(30);
    for (const viewport of ["desktop", "mobile"]) {
      expect(result.evidence.filter((row: { viewport: string; passed: boolean }) => row.viewport === viewport && row.passed)).toHaveLength(15);
    }
    expect(result.cleanup).toEqual({ browserClosed: true, browserProcessExited: true, httpClosed: true, portClosed: true, controlPortClosed: true });
  } finally {
    // This handle refers only to this exact recorded child; no name-based kill.
    if (child.exitCode === null) child.kill();
  }
});
