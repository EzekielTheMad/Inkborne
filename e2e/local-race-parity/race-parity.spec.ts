import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

test("actual race parity clients and shared sheet notice use root production CSS offline", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-race-parity-local.mjs"], { cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"] });
  let output = "";
  child.stdout!.on("data", chunk => { output += String(chunk); });
  child.stderr!.on("data", chunk => { output += String(chunk); });
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
    expect(evidence.browserExited).toBe(true);
    expect(evidence.fontChecks).toHaveLength(2);
    for (const check of evidence.fontChecks) expect(check.faces).toHaveLength(3);
    expect(evidence.fonts.map((font: { variable: string }) => font.variable)).toEqual(["--font-marcellus", "--font-eb-garamond"]);
  } finally {
    if (child.exitCode === null) {
      if (child.connected) child.send({ type: "stop" }, () => {});
      const ended = await new Promise<boolean>(resolve => {
        const timer = setTimeout(() => resolve(false), 10_000);
        child.once("exit", () => { clearTimeout(timer); resolve(true); });
        if (child.exitCode !== null) { clearTimeout(timer); resolve(true); }
      });
      if (!ended && child.exitCode === null && child.pid) {
        // Fresh PID/parent/script proof is required before ending this exact private tree.
        const probe = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
          `$probe=Get-CimInstance Win32_Process -Filter 'ProcessId=${child.pid}'; if(!$probe -or $probe.ParentProcessId -ne ${process.pid} -or $probe.CommandLine -notlike '*scripts/verify-race-parity-local.mjs*'){exit 3};exit 0`], { windowsHide: true });
        const probeCode = await new Promise<number | null>((resolve, reject) => { probe.once("error", reject); probe.once("exit", resolve); });
        expect(probeCode, "Refusing cleanup without current owned PID/parent/command proof").toBe(0);
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
        const killCode = await new Promise<number | null>((resolve, reject) => { killer.once("error", reject); killer.once("exit", resolve); });
        expect(killCode, "Owned harness process tree cleanup failed").toBe(0);
      }
    }
  }
});
