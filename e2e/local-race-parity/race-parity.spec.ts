import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

test("actual race parity clients and shared sheet notice use root production CSS offline", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-race-parity-local.mjs"], { cwd: process.cwd(), windowsHide: true });
  let output = "";
  child.stdout.on("data", chunk => { output += String(chunk); });
  child.stderr.on("data", chunk => { output += String(chunk); });
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    console.log(output);
    expect(code, output).toBe(0);
    const evidence = JSON.parse(await readFile("test-results/race-parity-local/evidence.json", "utf8"));
    expect(evidence.stylesheetSource).toBe("root-production-build");
    expect(evidence.liveSupabase).toBe(false);
    expect(evidence.failure).toBeNull();
    expect(evidence.evidence).toHaveLength(80);
    expect(evidence.screenshots).toHaveLength(16);
    for (const field of ["pageErrors", "blockedWrites", "blockedRemoteRequests", "unknownLocalRequests"]) expect(evidence[field]).toEqual([]);
    expect(evidence.portClosed).toBe(true); expect(evidence.browserPortClosed).toBe(true);
  } finally { if (child.exitCode === null) child.kill(); }
});
