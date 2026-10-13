import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { verifyItemSharingEntry, loadItemSharingProcess, rebindItemSharingInputs } from "../../scripts/item-sharing-production-inputs.mjs";

test("actual item draft and campaign access forms with frozen production inputs", async () => {
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startTime: new Date().toISOString(), port: null }));
  const entryProof = await verifyItemSharingEntry(process.cwd());
  const processes = await loadItemSharingProcess(process.cwd(), entryProof);
  const runner = path.resolve("scripts/verify-item-sharing-local.mjs");
  const child = spawn(process.execPath, [runner], { cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"] });
  let output = "";
  child.stdout!.on("data", chunk => { output += String(chunk); }); child.stderr!.on("data", chunk => { output += String(chunk); });
  type RenderedProof = { manifestPath: string; processReceipt: unknown; metafile: Parameters<typeof rebindItemSharingInputs>[3]; captured: Array<[string, unknown]>; artifacts: Record<string, unknown> };
  let renderedProof: RenderedProof | undefined;
  child.on("message", (message: unknown) => {
    if (message && typeof message === "object" && "type" in message && message.type === "rendered-inputs" && "proof" in message) {
      assert.equal(renderedProof, undefined, "Do not replace first rendered input receipt");
      renderedProof = message.proof as RenderedProof;
    }
  });
  const completion = new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  let identity: { pid: number; parentPid: number; command: string; birthUtc: string } | undefined;
  async function freshRenderedClosure() {
    assert.ok(renderedProof, "Refuse forced cleanup without the actual runner's rendered closure receipt");
    assert.deepEqual(JSON.parse(await readFile("test-results/item-sharing-local/rendered-inputs.json", "utf8")), renderedProof);
    await rebindItemSharingInputs(process.cwd(), renderedProof.manifestPath, renderedProof.processReceipt, renderedProof.metafile, new Map(renderedProof.captured), renderedProof.artifacts);
    assert.deepEqual(await verifyItemSharingEntry(process.cwd()), entryProof);
  }
  try {
    expect(child.pid).toBeDefined();
    try { identity = await processes.freshIdentity(child.pid!, process.pid); }
    catch { expect(child.exitCode, "Cannot force-clean unidentified live runner").not.toBeNull(); }
    if (identity) expect(identity.command).toContain(runner);
    const code = await completion; console.log(output); expect(code, output).toBe(0);
    const result = JSON.parse(await readFile("test-results/item-sharing-local/evidence.json", "utf8"));
    expect(result.liveSupabase).toBe(false); expect(result.persistence).toBe("unavailable");
    expect(result.artifacts.itemSharingSourceCheckpoint).toBe("b569b8f050cc61b565a46b89c064b299d48535e3");
    expect(result.artifacts.sourceCommit).toBe(result.artifacts.currentRootHead);
    expect(result.artifacts.harnessFiles).toHaveLength(6); expect(result.artifacts.itemSharingSourceFiles).toHaveLength(9);
    expect(result.artifacts.inheritedHelpers).toHaveLength(2);
    expect(result.artifacts.inheritedHelpers.map((item: { reviewedGitBlobOid: string }) => item.reviewedGitBlobOid)).toEqual(["e4058f8a31cd911583a312e59fedcf4c3fd4adae", "0841bda7b9e785280e684030bf4fe900d81465e5"]);
    expect(result.finalBindings.passed).toBe(true);
    expect(result.finalBindings.metafileSha256).toBe(result.artifacts.metafileSha256);
    for (const relativePath of ["components/library/item-form.tsx", "components/library/item-sharing-panel.tsx", "lib/homebrew/item-form.ts", "lib/schemas/content-types/item.ts"]) {
      expect(result.artifacts.bundledProjectInputs.some((input: { relativePath: string }) => input.relativePath === relativePath)).toBe(true);
    }
    expect(result.artifacts.bundledProjectInputs.some((input: { relativePath: string }) => input.relativePath.endsWith("/unstable-rethrow.browser.js"))).toBe(true);
    expect(result.artifacts.installedNodeClosure.length).toBeGreaterThanOrEqual(8);
    expect(result.taskProcess.birthUtc).toBe(identity?.birthUtc);
    expect(result.browserProcess.birthUtc).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(result.evidence).toHaveLength(24); expect(result.evidence.every((entry: { passed: boolean }) => entry.passed)).toBe(true);
    expect(new Set(result.screenshots).size).toBe(result.screenshots.length);
    expect(result.screenshots).toHaveLength(38);
    expect(result.fontEvidence).toHaveLength(result.screenshots.length);
    expect(result.fontEvidence.every((sample: { fonts: Array<{ family: string; statuses: string[] }> }) => sample.fonts.length === 3 && sample.fonts.every(font => font.family && font.statuses.every(status => status === "loaded")))).toBe(true);
    expect(result.assetRequests.some((asset: { path: string; sha256: string }) => /\.woff2?$/.test(asset.path) && /^[a-f0-9]{64}$/.test(asset.sha256))).toBe(true);
    expect(result.pageErrors).toEqual([]); expect(result.blockedRequests).toEqual([]); expect(result.unexpectedRequests).toEqual([]); expect(result.diagnostics).toEqual([]);
    expect(result.failure).toBeNull(); expect(result.portClosed).toBe(true); expect(result.browserPortClosed).toBe(true); expect(result.browserExited).toBe(true);
    await freshRenderedClosure();
  } finally {
    if (child.exitCode === null) {
      if (child.connected) child.send({ type: "stop" }, () => {});
      const ended = await new Promise<boolean>(resolve => {
        const timer = setTimeout(() => resolve(false), 10_000);
        child.once("exit", () => { clearTimeout(timer); resolve(true); });
        if (child.exitCode !== null) { clearTimeout(timer); resolve(true); }
      });
      if (!ended && child.exitCode === null) {
        expect(identity, "No force without original OS identity").toBeDefined();
        await processes.forceOwnedTree(identity!, freshRenderedClosure);
      }
    }
    assert.deepEqual(await verifyItemSharingEntry(process.cwd()), entryProof);
  }
});
