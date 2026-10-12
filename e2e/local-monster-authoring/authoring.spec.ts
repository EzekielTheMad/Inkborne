import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

test("actual MonsterForm with reviewed root assets and explicit synthetic responses", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid,
    cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-monster-authoring-local.mjs"], {
    cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout!.on("data", chunk => { output += String(chunk); });
  child.stderr!.on("data", chunk => { output += String(chunk); });
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject); child.once("exit", resolve);
    });
    console.log(output);
    expect(code, output).toBe(0);
    const result = JSON.parse(await readFile("test-results/monster-authoring-local/evidence.json", "utf8"));
    expect(result.liveSupabase).toBe(false);
    expect(result.persistence).toBe("synthetic session store only; database unavailable");
    expect(result.actionTransport).toBe("local synthetic functions, not Server Actions HTTP");
    expect(result.artifacts.acceptedFoundationCommit).toBe("cda325ae527c6c86ad7e45d4a886c1c85de2800d");
    expect(result.artifacts.sourceCommit).toBe(result.artifacts.currentRootHead);
    expect(result.artifacts.authoringSources).toHaveLength(7);
    expect(result.artifacts.actualNextNavigationInputs.length).toBeGreaterThan(0);
    expect(result.pageErrors).toEqual([]); expect(result.blockedRequests).toEqual([]); expect(result.unexpectedRequests).toEqual([]);
    expect(result.layoutFailures).toEqual([]); expect(result.failure).toBeNull();
    expect(result.evidence).toHaveLength(28);
    expect(result.portClosed).toBe(true); expect(result.browserPortClosed).toBe(true); expect(result.browserExited).toBe(true);
  } finally {
    if (child.exitCode === null) {
      // Same cooperative owned-worker cleanup as the reviewed foundation runner.
      if (child.connected) child.send({ type: "stop" }, () => {});
      const ended = await new Promise<boolean>(resolve => {
        const timer = setTimeout(() => resolve(false), 10_000);
        child.once("exit", () => { clearTimeout(timer); resolve(true); });
      });
      if (!ended && child.exitCode === null && child.pid) {
        const probe = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
          `$probe=Get-CimInstance Win32_Process -Filter 'ProcessId=${child.pid}'; if(!$probe -or $probe.ParentProcessId -ne ${process.pid} -or $probe.CommandLine -notlike '*scripts/verify-monster-authoring-local.mjs*'){exit 3};exit 0`], { windowsHide: true });
        const probeCode = await new Promise<number | null>((resolve, reject) => { probe.once("error", reject); probe.once("exit", resolve); });
        expect(probeCode, "Refusing cleanup without current owned PID/parent/command proof").toBe(0);
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
        const killCode = await new Promise<number | null>((resolve, reject) => { killer.once("error", reject); killer.once("exit", resolve); });
        expect(killCode, "Owned authoring harness cleanup failed").toBe(0);
      }
    }
  }
});
