import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  PROFILE, LIMITS, STAGES, canonicalJson, coreManifestHash, validateCoreApproval,
  observedCommand, assertCatalogDelta, expectedFunctionMetadata, assertFunctionMetadata, executeCore,
  type CoreManifest, type CoreApproval, type OsIdentity,
} from "../../scripts/core-db-verification";
import { TARGET, type Transport, type Command, type runtimeProcessRecords } from "../../scripts/equipment-runtime";

const resourceIds = { engineId: "engine:model", containerId: "a".repeat(64), imageId: "sha256:" + "b".repeat(64), networkId: "c".repeat(64) };
const manifest = { contractVersion: 1, scope: PROFILE, sourceSha: "d".repeat(40), target: TARGET, limits: LIMITS, resourceIds,
  equipment: {}, files: [], predecessor: {} } as unknown as CoreManifest;
const approval = (): CoreApproval => ({ gate: "G2", scope: PROFILE, approvedBy: "Victor", approvedAtUTC: "2026-10-13T17:00:00Z",
  sourceSha: manifest.sourceSha, manifestSha256: coreManifestHash(manifest), ...resourceIds, operations: ["install-disabled-stages", "verify-disabled-stages"] });
describe("additive profile admission model; no OS/Docker/SQL execution", () => {
  it("sorts object keys but preserves exact array order and original raw hashes", () => {
    expect(canonicalJson({ b: 1, a: [2, 1] })).toBe('{"a":[2,1],"b":1}');
    expect(coreManifestHash({ ...manifest, files: [{ path: "x", sha256: "a", gitBlob: "b" }] })).not.toBe(coreManifestHash(manifest));
    expect(() => canonicalJson({ impossible: undefined })).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
  });
  it("admits only an independently supplied exact new profile approval shape", () => {
    const exact = approval();
    expect(() => validateCoreApproval(manifest, exact, coreManifestHash(manifest))).not.toThrow();
    expect(() => validateCoreApproval(manifest, { ...exact, scope: "R07.1-baseline-and-stage" } as unknown as CoreApproval, exact.manifestSha256)).toThrow();
  });
  it.each([
    { gate: "G1" }, { approvedBy: "Agent" }, { approvedAtUTC: "not a UTC date" }, { sourceSha: "e".repeat(40) },
    { manifestSha256: "f".repeat(64) }, { containerId: "e".repeat(64) },
    { operations: ["verify-disabled-stages"] }, { operations: ["install-disabled-stages", "verify-disabled-stages", "activate"] },
  ])("rejects modeled approval drift %j before transport", change => {
    expect(() => validateCoreApproval(manifest, { ...approval(), ...change } as CoreApproval, coreManifestHash(manifest))).toThrow();
  });
  it("rejects missing explicit confirmation and changed target/budget", () => {
    expect(() => validateCoreApproval(manifest, approval(), "")).toThrow();
    expect(() => validateCoreApproval({ ...manifest, limits: { ...LIMITS, commands: 501 } } as CoreManifest, approval(), coreManifestHash(manifest))).toThrow();
    expect(() => validateCoreApproval({ ...manifest, target: { ...TARGET, context: "default" } } as unknown as CoreManifest, approval(), coreManifestHash(manifest))).toThrow();
  });
  it("actual native entry refuses inherited/absent G2 before source/OS/transport work", async () => {
    const transport = vi.fn(), capture = vi.fn(), resources = vi.fn(), save = vi.fn();
    await expect(executeCore({ root: process.cwd(), manifest, approval: { ...approval(), gate: "G1" } as unknown as CoreApproval,
      confirmation: coreManifestHash(manifest), transport, observer: { capture, resources }, records: () => [], save })).rejects.toThrow("G2");
    expect(transport).not.toHaveBeenCalled(); expect(capture).not.toHaveBeenCalled(); expect(resources).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
});
function commandModel(kind: "success" | "fast" | "reject" | "alive" | "reused" | "wrong-parent") {
  const command: Command = { args: ["--context", TARGET.context, "info"], timeoutMs: 30_000 };
  const records: ReturnType<typeof runtimeProcessRecords> = [];
  const record = { pid: 9001, parentPid: process.pid, cwd: process.cwd(), executable: "MODELED_DOCKER", args: command.args, startedUTC: "2026-10-13T17:00:00Z" };
  const identity: OsIdentity = { pid: 9001, parentPid: process.pid, birthUtc: "2026-10-13T17:00:00.0000000Z", command: "MODELED_DOCKER --context " + TARGET.context + " info" };
  const saved: unknown[] = []; let read = 0;
  const transport: Transport = async () => {
    records.push(record);
    await Promise.resolve(); Object.assign(record, { finishedUTC: "2026-10-13T17:00:01Z" });
    if (kind === "reject") throw Error("Modeled transport failure after exit; private raw detail");
    return { code: 0, stdout: "{}" };
  };
  const observer = {
    capture: vi.fn(() => {
      read++;
      if (kind === "fast") return null;
      if (read === 1) return kind === "wrong-parent" ? { ...identity, parentPid: -1 } : identity;
      if (kind === "alive") return identity;
      if (kind === "reused") return { ...identity, birthUtc: "2026-10-13T17:00:02.0000000Z" };
      return null;
    }),
    resources: vi.fn(),
  };
  return { command, transport, observer, records: () => structuredClone(records), save: (value: unknown) => { saved.push(value); }, saved };
}
describe("injected OS observer protocol; never invokes nativeObserver", () => {
  it("records actual-shaped identity and fresh absence, independent of code0 alone", async () => {
    const model = commandModel("success");
    expect(await observedCommand(model)).toMatchObject({ code: 0 });
    expect(model.observer.capture).toHaveBeenCalledTimes(2);
    expect(model.saved).toMatchObject([{ osIdentity: { pid: 9001 }, absent: true, resultCode: 0 }]);
  });
  it.each(["fast", "reject", "alive", "wrong-parent"] as const)("stops uncertain on %s with evidence; no guessed identity or extra kill", async kind => {
    const model = commandModel(kind);
    await expect(observedCommand(model)).rejects.toThrow("uncertain");
    expect(model.saved).toHaveLength(1);
    expect(JSON.stringify(model.saved)).not.toContain("private raw detail");
    if (kind === "fast") expect(model.saved[0]).not.toHaveProperty("osIdentity");
    if (kind === "reject") expect(model.saved[0]).toMatchObject({ absent: true });
  });
  it("preserves an unrelated reused PID instead of treating it as the old child", async () => {
    const model = commandModel("reused");
    await expect(observedCommand(model)).resolves.toMatchObject({ code: 0 });
    expect(model.saved[0]).toMatchObject({ absent: true });
  });
});
const emptyAudit = () => ({ extensions: [], roles: [], tables: [{ schema: "private", name: "existing_equipment", owner: "postgres" }],
  functions: [], triggers: [], policies: [], table_grants: [], rowCounts: [{ schema: "private", table: "existing_equipment", rows: 1 }] });
describe("source/catalog protocol controls; no database engine", () => {
  it("rejects original equipment data/catalog drift while allowing only declared new private tables", () => {
    const before = emptyAudit();
    expect(() => assertCatalogDelta(before, { ...before, rowCounts: [{ schema: "private", table: "existing_equipment", rows: 0 }] })).toThrow();
    expect(() => assertCatalogDelta(before, { ...before, tables: [{ schema: "private", name: "existing_equipment", owner: "foreign" }] })).toThrow();
    expect(() => assertCatalogDelta(before, { ...before, tables: [...before.tables, { schema: "private", name: "undeclared", owner: "postgres" }] })).toThrow();
    expect(() => assertCatalogDelta(before, { ...before, tables: [...before.tables, { schema: "private", name: "character_action_receipts", owner: "postgres" }],
      rowCounts: [...before.rowCounts, { schema: "private", table: "character_action_receipts", rows: 0 }] })).not.toThrow();
  });
  it("binds every complete frozen function body/owner/security flag, not successful metadata alone", () => {
    const sql = STAGES.map(file => readFileSync(file, "utf8"));
    const expected = expectedFunctionMetadata(sql);
    expect(expected.length).toBeGreaterThan(20);
    const rows = expected.map(row => ({ ...row, definition_md5: "a".repeat(32) }));
    expect(() => assertFunctionMetadata(sql, rows)).not.toThrow();
    expect(() => assertFunctionMetadata(sql, rows.slice(1))).toThrow();
    expect(() => assertFunctionMetadata(sql, rows.map((row, index) => index ? row : { ...row, source_md5: "b".repeat(32) }))).toThrow();
    expect(() => assertFunctionMetadata(sql, rows.map((row, index) => index ? row : { ...row, owner: "postgres" }))).toThrow();
  });
});
