import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

test("real armor form submits and recovers offline at desktop/mobile sizes", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid,
    cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-armors-local.mjs"], {
    cwd: process.cwd(), windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", chunk => { output += String(chunk); });
  child.stderr.on("data", chunk => { output += String(chunk); });
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    console.log(output);
    expect(code, output).toBe(0);
    const evidence = JSON.parse(await readFile("test-results/armors-local/evidence.json", "utf8"));
    expect(evidence.liveSupabase).toBe(false);
    expect(evidence.pageErrors).toEqual([]);
    expect(evidence.blockedRemoteRequests).toEqual([]);
    expect(evidence.evidence).toHaveLength(16);
    expect(evidence.portClosed).toBe(true);
    expect(evidence.browserPortClosed).toBe(true);
  } finally {
    if (child.exitCode === null) child.kill();
  }
});
