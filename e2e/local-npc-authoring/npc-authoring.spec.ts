import { expect, test } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { verifyNpcAuthoringHelpers } from "../../scripts/npc-authoring-production-inputs.mjs";

test("actual private NPC form with guarded production assets and private cleanup", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const helperProof = await verifyNpcAuthoringHelpers(process.cwd());
  const { npcOsIdentity } = await import("../../scripts/npc-process.mjs");
  const child = spawn(process.execPath, [path.resolve("scripts/verify-npc-authoring-local.mjs")], {
    cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout!.on("data", chunk => { output += String(chunk); }); child.stderr!.on("data", chunk => { output += String(chunk); });
  const completion = new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  let identity: { pid: number; parentPid: number; command: string; birthUtc: string } | undefined;
  try {
    expect(child.pid).toBeDefined();
    try { identity = npcOsIdentity(child.pid!, process.pid); }
    catch { expect(child.exitCode, "Cannot force-clean an unidentified live runner").not.toBeNull(); }
    if (identity) expect(identity.command).toContain(path.resolve("scripts/verify-npc-authoring-local.mjs"));
    const code = await completion; console.log(output); expect(code, output).toBe(0);
    const result = JSON.parse(await readFile("test-results/npc-authoring-local/evidence.json", "utf8"));
    expect(result.liveSupabase).toBe(false); expect(result.persistence).toBe("unavailable");
    expect(result.artifacts.npcAuthoringSourceCheckpoint).toBe("1fc362009f260ca3469fb4440a4f884b702c2e79");
    expect(result.artifacts.sourceCommit).toBe(result.artifacts.currentRootHead);
    expect(result.artifacts.dependencyLockSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artifacts.metafileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artifacts.harnessFiles).toHaveLength(6);
    expect(result.artifacts.authoringSourceFiles).toHaveLength(8);
    expect(result.artifacts.authoringHelperDependencies).toHaveLength(2);
    expect(result.artifacts.authoringHelperDependencies.find((item: { relativePath: string }) => item.relativePath === "scripts/passive-feature-production-assets.mjs").expected).toBe("e4058f8a31cd911583a312e59fedcf4c3fd4adae");
    for (const relativePath of ["components/library/npc-form.tsx", "lib/homebrew/npc-form.ts", "lib/schemas/content-types/npc.ts", "tests/fixtures/npcs.ts"])
      expect(result.artifacts.bundledProjectInputs.some((input: { relativePath: string }) => input.relativePath === relativePath)).toBe(true);
    expect(result.taskProcess.birthUtc).toBe(identity?.birthUtc);
    expect(result.browserProcess.birthUtc).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(result.evidence).toHaveLength(18); expect(result.evidence.every((entry: { passed: boolean }) => entry.passed)).toBe(true);
    expect(result.screenshots).toHaveLength(20); expect(new Set(result.screenshots).size).toBe(20);
    expect(result.fontEvidence).toHaveLength(20);
    expect(result.fontEvidence.every((sample: { fonts: Array<{ family: string; statuses: string[] }> }) => sample.fonts.length === 3 && sample.fonts.every(font => font.family && font.statuses.every(status => status === "loaded")))).toBe(true);
    expect(result.assetRequests.some((asset: { path: string; sha256: string }) => /\.woff2?$/.test(asset.path) && /^[a-f0-9]{64}$/.test(asset.sha256))).toBe(true);
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
      if (!ended && child.exitCode === null) {
        expect(identity, "Refuse forced cleanup without original OS birth/PID/parent/command").toBeDefined();
        assert.deepEqual(await verifyNpcAuthoringHelpers(process.cwd()), helperProof);
        const fresh = npcOsIdentity(identity!.pid, identity!.parentPid);
        expect(fresh.birthUtc).toBe(identity!.birthUtc); expect(fresh.command).toBe(identity!.command);
        expect(fresh.command).toContain(path.resolve("scripts/verify-npc-authoring-local.mjs"));
        execFileSync("taskkill", ["/pid", String(identity!.pid), "/T", "/F"], { windowsHide: true });
      }
    }
    assert.deepEqual(await verifyNpcAuthoringHelpers(process.cwd()), helperProof);
  }
});
