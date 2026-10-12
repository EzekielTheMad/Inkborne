import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadCompanionProcess } from "../../scripts/companion-process.mjs";
import { bindCompanionHarnessFiles } from "../../scripts/companion-production-inputs.mjs";

test("actual declared companion Library with guarded production assets and private cleanup", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const processes = await loadCompanionProcess(process.cwd());
  const child = spawn(process.execPath, [path.resolve("scripts/verify-companions-local.mjs")], {
    cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout!.on("data", chunk => { output += String(chunk); }); child.stderr!.on("data", chunk => { output += String(chunk); });
  const completion = new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  let identity: { pid: number; parentPid: number; command: string; birthUtc: string } | undefined;
  try {
    expect(child.pid).toBeDefined();
    try { identity = await processes.freshIdentity(child.pid!, process.pid); }
    catch { expect(child.exitCode, "Cannot force-clean an unidentified live runner").not.toBeNull(); }
    if (identity) expect(identity.command).toContain(path.resolve("scripts/verify-companions-local.mjs"));
    const code = await completion; console.log(output); expect(code, output).toBe(0);
    const result = JSON.parse(await readFile("test-results/companions-local/evidence.json", "utf8"));
    expect(result.liveSupabase).toBe(false); expect(result.persistence).toBe("unavailable");
    expect(result.artifacts.companionSourceCheckpoint).toBe("5cc9aad4ae1c875c915a36d7fed6966441e44e49");
    expect(result.artifacts.sourceCommit).toBe(result.artifacts.currentRootHead);
    expect(result.artifacts.dependencyLockSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artifacts.metafileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artifacts.harnessSourceSha).toMatch(/^[a-f0-9]{40}$/);
    expect(result.artifacts.harnessFiles).toHaveLength(6);
    expect(result.artifacts.harnessFiles).toEqual(await bindCompanionHarnessFiles(process.cwd()));
    for (const receipt of result.artifacts.harnessFiles) {
      expect(receipt.executedSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(receipt.gitBlobSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(receipt.checkoutIdentities).toHaveLength(2);
      expect(receipt.checkoutIdentities.every((entry: { headBlobOid: string; indexBlobOid: string }) => entry.headBlobOid === receipt.gitBlobOid && entry.indexBlobOid === receipt.gitBlobOid)).toBe(true);
    }
    expect(result.finalBindings?.passed).toBe(true);
    expect(result.finalBindings.harnessFiles).toEqual(result.artifacts.harnessFiles);
    expect(result.finalBindings.inheritedHelpers).toEqual(result.artifacts.inheritedHelpers);
    expect(result.finalBindings.currentRootHead).toBe(result.artifacts.currentRootHead);
    expect(result.finalBindings.metafileSha256).toBe(result.artifacts.metafileSha256);
    expect(result.artifacts.inheritedHelpers).toHaveLength(2);
    for (const oid of ["e4058f8a31cd911583a312e59fedcf4c3fd4adae", "0841bda7b9e785280e684030bf4fe900d81465e5"]) {
      const receipt = result.artifacts.inheritedHelpers.find((entry: { reviewedGitBlobOid: string }) => entry.reviewedGitBlobOid === oid);
      expect(receipt).toBeDefined();
      expect(receipt.executedSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(receipt.canonicalBlobSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(receipt.checkoutIdentities).toHaveLength(2);
      expect(receipt.checkoutIdentities.every((entry: { headBlobOid: string; indexBlobOid: string }) => entry.headBlobOid === oid && entry.indexBlobOid === oid)).toBe(true);
    }
    expect(result.artifacts.inheritedHelpers.find((entry: { relativePath: string }) => entry.relativePath === "scripts/npc-process.mjs")).toEqual(processes.receipt);
    for (const relativePath of ["lib/schemas/content-types/companion.ts", "lib/supabase/content-definitions-parser.ts", "components/compendium/companion-profile.tsx", "components/compendium/compendium-detail.tsx", "tests/fixtures/companions.ts"]) {
      expect(result.artifacts.bundledProjectInputs.some((input: { relativePath: string; sha256: string }) => input.relativePath === relativePath && /^[a-f0-9]{64}$/.test(input.sha256))).toBe(true);
    }
    expect(result.taskProcess.birthUtc).toBe(identity?.birthUtc);
    expect(result.browserProcess.birthUtc).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(result.evidence).toHaveLength(22); expect(result.evidence.every((entry: { passed: boolean }) => entry.passed)).toBe(true);
    expect(result.screenshots).toHaveLength(22); expect(new Set(result.screenshots).size).toBe(22);
    expect(result.fontEvidence).toHaveLength(22);
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
        await processes.forceOwnedTree(identity!);
      }
    }
  }
});
