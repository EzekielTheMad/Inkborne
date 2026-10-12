import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

test("actual standalone PassiveFeatureForm survives bounded offline outcomes with verified production assets", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const child = spawn(process.execPath, ["scripts/verify-passive-features-local.mjs"], { cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"] });
  let output = "";
  child.stdout!.on("data", chunk => { output += String(chunk); }); child.stderr!.on("data", chunk => { output += String(chunk); });
  // Install completion before querying the OS: preflight can fail and exit quickly.
  const completion = new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  let runnerBirthUtc: string | undefined;
  let runnerCommand: string | undefined;
  try {
    expect(child.pid, "Owned runner PID was not assigned").toBeDefined();
    const birthProbe = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `$probe=Get-CimInstance Win32_Process -Filter 'ProcessId=${child.pid}'; if(!$probe -or $probe.ParentProcessId -ne ${process.pid} -or $probe.CommandLine -notlike '*scripts/verify-passive-features-local.mjs*' -or !$probe.CreationDate){exit 3};@{birthUtc=$probe.CreationDate.ToUniversalTime().ToString('o');command=$probe.CommandLine}|ConvertTo-Json -Compress`], { windowsHide: true });
    let birthText = "";
    birthProbe.stdout!.on("data", chunk => { birthText += String(chunk); });
    const birthCode = await new Promise<number | null>((resolve, reject) => { birthProbe.once("error", reject); birthProbe.once("exit", resolve); });
    if (birthCode === 0) {
      const identity: { birthUtc: string; command: string } = JSON.parse(birthText);
      expect(identity.birthUtc, "OS CreationDate must be an explicit UTC instant").toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
      expect(identity.command).toContain("scripts/verify-passive-features-local.mjs");
      runnerBirthUtc = identity.birthUtc;
      runnerCommand = identity.command;
    } else {
      expect(child.exitCode, "Refusing to run/force-clean an unidentified live process").not.toBeNull();
    }
    await mkdir("test-results/passive-features-local", { recursive: true });
    await writeFile("test-results/passive-features-local/runner-os-birth.json", JSON.stringify({ runnerPid: child.pid, parentPid: process.pid,
      cwd: process.cwd(), command: runnerCommand ?? null, birthSource: "Win32_Process.CreationDate", runnerBirthUtc: runnerBirthUtc ?? null, captureExitCode: birthCode }, null, 2));
    console.log(JSON.stringify({ runnerPid: child.pid, runnerBirthUtc, captureExitCode: birthCode }));
    const code = await completion;
    console.log(output); expect(code, output).toBe(0);
    const result = JSON.parse(await readFile("test-results/passive-features-local/evidence.json", "utf8"));
    expect(result.liveSupabase).toBe(false); expect(result.simulatedActions).toBe(true); expect(result.simulatedNavigation).toBe(true);
    expect(result.artifacts.sourceCommit).toBe(result.artifacts.currentRootHead);
    expect(result.artifacts.approvedPassiveFeatureSource).toBe("6f43b57b574faaeb7536aad4ded592cb1bb1e449");
    expect(result.artifacts.dependencyLockSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artifacts.metafileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artifacts.actualNextNavigationInputs.some((input: { relativePath: string }) => input.relativePath.endsWith("/unstable-rethrow.browser.js"))).toBe(true);
    expect(result.taskProcess.birthUtc).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(result.browserProcess.birthUtc).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    for (const relativePath of ["components/library/passive-feature-form.tsx", "lib/homebrew/passive-feature-form.ts", "lib/schemas/content-types/feature.ts"]) {
      expect(result.artifacts.bundledProjectInputs.some((input: { relativePath: string; sha256: string }) => input.relativePath === relativePath && /^[a-f0-9]{64}$/.test(input.sha256))).toBe(true);
    }
    expect(result.evidence).toHaveLength(44); expect(result.screenshots).toHaveLength(44);
    expect(result.pageErrors).toEqual([]); expect(result.blockedRequests).toEqual([]); expect(result.unexpectedRequests).toEqual([]);
    expect(result.failure).toBeNull(); expect(result.portClosed).toBe(true); expect(result.browserPortClosed).toBe(true); expect(result.browserExited).toBe(true);
  } finally {
    if (child.exitCode === null) {
      if (child.connected) child.send({ type: "stop" }, () => {});
      const ended = await new Promise<boolean>(resolve => {
        const timer = setTimeout(() => resolve(false), 10_000);
        child.once("exit", () => { clearTimeout(timer); resolve(true); });
        if (child.exitCode !== null) { clearTimeout(timer); resolve(true); }
      });
      if (!ended && child.exitCode === null && child.pid) {
        expect(runnerBirthUtc, "Refusing forced cleanup without captured OS process birth").toBeDefined();
        expect(runnerCommand, "Refusing forced cleanup without captured OS command").toBeDefined();
        const commandBase64 = Buffer.from(runnerCommand!, "utf8").toString("base64");
        const probe = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
          `$expectedCommand=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${commandBase64}'));$probe=Get-CimInstance Win32_Process -Filter 'ProcessId=${child.pid}'; if(!$probe -or $probe.ParentProcessId -ne ${process.pid} -or $probe.CommandLine -cne $expectedCommand -or !$probe.CreationDate -or $probe.CreationDate.ToUniversalTime().ToString('o') -cne '${runnerBirthUtc}'){exit 3};exit 0`], { windowsHide: true });
        const probeCode = await new Promise<number | null>((resolve, reject) => { probe.once("error", reject); probe.once("exit", resolve); });
        expect(probeCode, "Refusing cleanup without fresh exact private PID/parent/script/OS birth proof").toBe(0);
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
        const killCode = await new Promise<number | null>((resolve, reject) => { killer.once("error", reject); killer.once("exit", resolve); });
        expect(killCode, "Owned harness private-tree cleanup failed").toBe(0);
      }
    }
  }
});
