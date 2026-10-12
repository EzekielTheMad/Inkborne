import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

test("actual MonsterForm with reviewed root assets and explicit synthetic responses", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid,
    cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-monster-authoring-local.mjs"], {
    cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout!.on("data", chunk => { output += String(chunk); });
  child.stderr!.on("data", chunk => { output += String(chunk); });
  // Register completion before the OS probe: a preflight failure can exit quickly.
  const completion = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject); child.once("exit", resolve);
  });
  let runnerBirthUtc: string | undefined;
  try {
    expect(child.pid, "Owned runner PID was not assigned").toBeDefined();
    const birthProbe = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `$probe=Get-CimInstance Win32_Process -Filter 'ProcessId=${child.pid}'; if(!$probe -or $probe.ParentProcessId -ne ${process.pid} -or $probe.CommandLine -notlike '*scripts/verify-monster-authoring-local.mjs*'){exit 3};$probe.CreationDate.ToUniversalTime().ToString('o')`], { windowsHide: true });
    let birthText = "";
    birthProbe.stdout!.on("data", chunk => { birthText += String(chunk); });
    const birthCode = await new Promise<number | null>((resolve, reject) => { birthProbe.once("error", reject); birthProbe.once("exit", resolve); });
    if (birthCode === 0) {
      runnerBirthUtc = birthText.trim();
      expect(runnerBirthUtc, "OS CreationDate must be an explicit UTC instant").toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
    } else {
      expect(child.exitCode, "Refusing to run/force-clean an unidentified live process").not.toBeNull();
    }
    await mkdir("test-results/monster-authoring-local", { recursive: true });
    await writeFile("test-results/monster-authoring-local/runner-os-birth.json", JSON.stringify({
      runnerPid: child.pid, parentPid: process.pid, cwd: process.cwd(), birthSource: "Win32_Process.CreationDate",
      runnerBirthUtc: runnerBirthUtc ?? null, captureExitCode: birthCode,
    }, null, 2));
    console.log(JSON.stringify({ runnerPid: child.pid, runnerBirthUtc, captureExitCode: birthCode }));
    const code = await completion;
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
        expect(runnerBirthUtc, "Refusing forced cleanup without captured OS process birth").toBeDefined();
        const probe = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
          `$probe=Get-CimInstance Win32_Process -Filter 'ProcessId=${child.pid}'; if(!$probe -or $probe.ParentProcessId -ne ${process.pid} -or $probe.CommandLine -notlike '*scripts/verify-monster-authoring-local.mjs*' -or $probe.CreationDate.ToUniversalTime().ToString('o') -ne '${runnerBirthUtc}'){exit 3};exit 0`], { windowsHide: true });
        const probeCode = await new Promise<number | null>((resolve, reject) => { probe.once("error", reject); probe.once("exit", resolve); });
        expect(probeCode, "Refusing cleanup without fresh owned PID/parent/command/exact birth proof").toBe(0);
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
        const killCode = await new Promise<number | null>((resolve, reject) => { killer.once("error", reject); killer.once("exit", resolve); });
        expect(killCode, "Owned authoring harness cleanup failed").toBe(0);
      }
    }
  }
});
