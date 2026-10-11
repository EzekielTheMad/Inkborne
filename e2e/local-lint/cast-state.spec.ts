import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

for (const fixture of ["play-save", "casting-resources"]) {
  test(`real cast/state controls recover offline (${fixture})`, async () => {
    const child = spawn(process.execPath, ["scripts/verify-" + fixture + "-local.mjs"], {
      cwd: process.cwd(),
      windowsHide: true,
    });
    console.log(JSON.stringify({
      workerPid: process.pid, parentPid: process.ppid, childPid: child.pid,
      cwd: process.cwd(), command: "scripts/verify-" + fixture + "-local.mjs",
      startTime: new Date().toISOString(),
    }));
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
      const evidence = JSON.parse(await readFile(`test-results/${fixture}-local/evidence.json`, "utf8"));
      expect(evidence.simulated).toBe(true);
      expect(evidence.errors).toEqual([]);
      expect(evidence.remoteRequests).toEqual([]);
      expect(evidence.evidence.length).toBeGreaterThan(0);
    } finally {
      if (child.exitCode === null) child.kill();
    }
  });
}
