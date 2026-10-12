import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { companionProcessHelper, verifyCompanionInheritedHelper } from "./companion-production-inputs.mjs";

/** Reuse reviewed OS identity/resources code only after independent exact-byte
 * guard. Do not use the NPC-only force-kill function for a different runner. */
export async function loadCompanionProcess(root) {
  const receipt = await verifyCompanionInheritedHelper(root, companionProcessHelper);
  const inherited = await import("./npc-process.mjs");
  async function verifyFresh() {
    assert.deepEqual(await verifyCompanionInheritedHelper(root, companionProcessHelper), receipt, "Process executable changed since guarded import");
  }
  return { receipt, osIdentity: inherited.npcOsIdentity, resources: inherited.npcResources, assertNoOtherRunner: inherited.assertNoOtherNpcRunner,
    async freshIdentity(pid, parentPid) {
      await verifyFresh(); return inherited.npcOsIdentity(pid, parentPid);
    },
    async forceOwnedTree(identity) {
      await verifyFresh();
      const fresh = inherited.npcOsIdentity(identity.pid, identity.parentPid);
      assert.equal(fresh.birthUtc, identity.birthUtc); assert.equal(fresh.command, identity.command);
      assert.ok(fresh.command.includes(path.join(root, "scripts", "verify-companions-local.mjs")), "Refuse unrelated private tree");
      execFileSync("taskkill", ["/pid", String(identity.pid), "/T", "/F"], { windowsHide: true });
    } };
}
