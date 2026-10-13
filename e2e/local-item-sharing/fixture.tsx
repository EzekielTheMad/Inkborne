import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ItemForm } from "@/components/library/item-form";
import { ItemSharingPanel } from "@/components/library/item-sharing-panel";
import { mapHomebrewItemFormData } from "@/lib/homebrew/item-form";
import { itemDataSchema } from "@/lib/schemas/content-types/item";

const contentId = "33333333-3333-4333-8333-333333333333";
const campaignA = "44444444-4444-4444-8444-444444444444", campaignB = "55555555-5555-4555-8555-555555555555";
const scenario = new URLSearchParams(location.search).get("scenario") ?? "workflow";
const latest = localStorage.getItem("item-sharing-latest") === "2";
const originalData = itemDataSchema.parse({ description: "Original bounded lantern narrative.", equipment_category: "Gear", cost: { quantity: 7, unit: "gp" }, weight: 2 });
type Request = { contentId: string; campaignId: string; enabled: boolean; expectedVersion: number };
const calls: Array<{ kind: string; request?: Request; fields?: Record<string, FormDataEntryValue> }> = [], navigation: unknown[] = [];
const shared = new Set<string>(latest ? [campaignA] : []);
let storedVersion = latest ? 2 : 1;
let finish: ((value: unknown) => void) | undefined;
let revalidate: ((kind: string) => void) | undefined;
const bridge = {
  scenario, calls, navigation,
  submit: async (mode: string, _previous: unknown, form: FormData): Promise<unknown> => {
    calls.push({ kind: mode, fields: Object.fromEntries(form) });
    const mapped = mapHomebrewItemFormData(form);
    if (!mapped.success) return { status: "error", message: "Modeled field validation refusal.", fieldErrors: mapped.fieldErrors };
    return { status: "error", message: "Modeled save refused; draft retained." };
  },
  share: async (_previous: unknown, form: FormData): Promise<unknown> => {
    const request = { contentId: String(form.get("content_id")), campaignId: String(form.get("campaign_id")), enabled: form.get("enabled") === "true", expectedVersion: Number(form.get("expected_version")) };
    calls.push({ kind: "share", request });
    if (scenario === "pending" || scenario === "same-tick") return new Promise(resolve => { finish = resolve; });
    if (scenario === "stale") {
      localStorage.setItem("item-sharing-latest", "2");
      return { status: "conflict", message: "Modeled current-version conflict; reload.", ...request };
    }
    if (scenario === "malformed") return undefined;
    if (scenario === "lost") throw Error("Modeled ordinary action transport response lost");
    const priorCount = shared.size;
    request.enabled ? shared.add(request.campaignId) : shared.delete(request.campaignId);
    if ((priorCount === 0) !== (shared.size === 0)) storedVersion++;
    localStorage.setItem("item-sharing-latest", "2");
    if (scenario === "cache-loss") throw Error("Modeled ordinary post-RPC cache loss");
    return { status: "idle", message: "Modeled exact campaign acknowledgement.", ...request,
      ...(scenario === "wrong-tuple" ? { campaignId: campaignB } : {}),
      version: storedVersion, scope: shared.size ? "shared" : "personal", sharedCampaignCount: shared.size };
  },
  release: () => {
    if (!finish) throw Error("No pending modeled response");
    finish({ status: "idle", message: "Modeled pending acknowledgement.", contentId, campaignId: campaignA, enabled: true, expectedVersion: latest ? 2 : 1, version: 2, scope: "shared", sharedCampaignCount: 1 });
  },
  revalidate: (kind: string) => { if (!revalidate) throw Error("Fixture not mounted"); revalidate(kind); },
};
Object.assign(window, { itemSharing: bridge });
function Fixture() {
  const [identity, setIdentity] = useState({ id: contentId, version: latest ? 2 : 1 });
  const [access, setAccess] = useState({ version: latest ? 2 : 1, scope: latest ? "shared" as const : "personal" as const, count: latest ? 1 : 0, sharedA: latest });
  revalidate = kind => {
    if (kind === "identity") setIdentity({ id: "66666666-6666-4666-8666-666666666666", version: identity.version });
    else if (kind === "access") setAccess({ version: 3, scope: "personal", count: 0, sharedA: false });
    else setIdentity({ ...identity, version: identity.version + 1 });
  };
  return <div className="mx-auto max-w-4xl space-y-7">
    <p className="text-sm">Offline actual ItemForm and ItemSharingPanel. Auth, owner/member access, reads, actions, RPCs, cache, database clocks and reload data are modeled. No live write or database acceptance.</p>
    <p role="status">Modeled loaded version {latest ? 2 : 1}</p>
    <ItemForm mode="edit" initialValue={{ ...identity, name: "Original Lantern", data: originalData }} />
    <ItemSharingPanel contentId={contentId} version={access.version} scope={access.scope} sharedCampaignCount={access.count}
      campaigns={[{ id: campaignA, name: "Original Tuesday", shared: access.sharedA, eligible: true }, { id: campaignB, name: "Original Weekend", shared: false, eligible: true }]} />
  </div>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
