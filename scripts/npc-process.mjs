import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const ps = code => execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code], { encoding: "utf8", windowsHide: true });
export function npcOsIdentity(pid, parentPid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0 && Number.isSafeInteger(parentPid) && parentPid > 0);
  const value = JSON.parse(ps(`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}';if(!$p -or $p.ParentProcessId -ne ${parentPid} -or !$p.CreationDate){exit 3};@{pid=$p.ProcessId;parentPid=$p.ParentProcessId;command=$p.CommandLine;birthUtc=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress`));
  assert.match(value.birthUtc, /^\d{4}-\d{2}-\d{2}T.*Z$/); assert.ok(value.command); return value;
}
export function npcResources() {
  return JSON.parse(ps("$p=@(Get-Process);@{timeUtc=(Get-Date).ToUniversalTime().ToString('o');processCount=$p.Count;workingSetBytes=($p|Measure-Object WorkingSet64 -Sum).Sum;cpuSeconds=($p|Measure-Object CPU -Sum).Sum;listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue).Count}|ConvertTo-Json -Compress"));
}
export function assertNoOtherNpcRunner(scriptPath, pid) {
  const encoded = Buffer.from(scriptPath, "utf8").toString("base64");
  const count = Number(ps(`$scriptPath=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'));@(Get-CimInstance Win32_Process|Where-Object {$_.ProcessId -ne ${pid} -and $_.CommandLine -and $_.CommandLine.Contains($scriptPath)}).Count`));
  assert.equal(count, 0, "A runner for this exact NPC worktree already exists");
}
export function forceOwnedNpcTree(identity) {
  // Re-read all four identity fields immediately before the exact private-tree kill.
  const fresh = npcOsIdentity(identity.pid, identity.parentPid);
  assert.equal(fresh.birthUtc, identity.birthUtc); assert.equal(fresh.command, identity.command);
  assert.match(fresh.command, /verify-npcs-local\.mjs/);
  execFileSync("taskkill", ["/pid", String(identity.pid), "/T", "/F"], { windowsHide: true });
}
