import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  syncRefs: vi.fn(),
  getRefs: vi.fn(),
  listFeats: vi.fn(),
  setChoice: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/feat-selection-server", () => ({
  listUsableFeatsForCharacter: mocks.listFeats,
  setCharacterAsiChoiceRecord: mocks.setChoice,
}));
vi.mock("@/lib/supabase/feature-refs-server", () => ({ syncClassFeatureRefs: mocks.syncRefs }));
vi.mock("@/lib/supabase/content-refs", () => ({ getContentRefsByCharacter: mocks.getRefs }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  reconcileClassFeatureRefsAction,
  searchUsableFeatsAction,
  setCharacterAsiChoiceAction,
} from "@/app/(app)/characters/[id]/builder/class/actions";

const input = {
  characterId: "11111111-1111-4111-8111-111111111111",
  featureSlug: "fighter-ability-score-improvement-4",
  choice: {
    mode: "feat" as const,
    featId: "22222222-2222-4222-8222-222222222222",
    featVersion: 3,
  },
};

describe("character feat choice action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  });

  it("runs a server-backed, ASI-slot-aware feat search", async () => {
    const feats = [{
      id: input.choice.featId,
      name: "Ember Sentinel",
      description: "Stand watch.",
      version: 3,
      source: "homebrew",
      scope: "shared",
      prerequisiteMet: true,
      prerequisiteReason: null,
    }];
    mocks.listFeats.mockResolvedValue(feats);

    await expect(searchUsableFeatsAction({
      characterId: input.characterId,
      featureSlug: input.featureSlug,
      query: "ember",
    })).resolves.toEqual({ status: "success", feats });
    expect(mocks.listFeats).toHaveBeenCalledWith(
      input.characterId,
      "ember",
      input.featureSlug,
    );
  });

  it("does not run feat search for an unauthenticated caller", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(searchUsableFeatsAction({
      characterId: input.characterId,
      featureSlug: input.featureSlug,
      query: "ember",
    })).resolves.toEqual({
      status: "error",
      message: "Sign in before searching for feats.",
    });
    expect(mocks.listFeats).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated direct action call", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(setCharacterAsiChoiceAction(input)).resolves.toEqual({
      status: "error",
      code: "unauthorized",
      message: "Sign in before changing this character.",
    });
    expect(mocks.setChoice).not.toHaveBeenCalled();
  });

  it("rejects broad or malformed feat payloads before the DAL", async () => {
    await expect(setCharacterAsiChoiceAction({
      ...input,
      choice: { ...input.choice, effects: [{ type: "mechanical" }] },
    })).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(mocks.setChoice).not.toHaveBeenCalled();
  });

  it("passes a narrow choice through and revalidates builder and sheet", async () => {
    const choices = {
      asi_choices: { [input.featureSlug]: input.choice },
    };
    mocks.setChoice.mockResolvedValue({
      status: "success",
      featureSlug: input.featureSlug,
      choice: input.choice,
      choices,
    });

    await expect(setCharacterAsiChoiceAction(input)).resolves.toMatchObject({
      status: "success",
      choices,
    });
    expect(mocks.setChoice).toHaveBeenCalledWith(input);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/characters/${input.characterId}/builder/class`,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/characters/${input.characterId}`);
  });
});

describe("existing class feature reconciliation action",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:"owner"}}});mocks.syncRefs.mockResolvedValue({inserted:1,deleted:0});mocks.getRefs.mockResolvedValue([{content_id:"old-feature",content_version:1}]);});
  it("rejects unauthenticated and malformed calls without running the RPC",async()=>{
    await expect(reconcileClassFeatureRefsAction({characterId:"bad"})).resolves.toMatchObject({status:"error"});
    mocks.getUser.mockResolvedValueOnce({data:{user:null}});
    await expect(reconcileClassFeatureRefsAction({characterId:input.characterId})).resolves.toMatchObject({status:"error"});
    expect(mocks.syncRefs).not.toHaveBeenCalled();
  });
  it("calls existing owner-checked reconciliation before reading exact saved refs",async()=>{
    await expect(reconcileClassFeatureRefsAction({characterId:input.characterId})).resolves.toEqual({status:"success",refs:[{content_id:"old-feature",content_version:1}]});
    expect(mocks.syncRefs).toHaveBeenCalledWith(expect.anything(),{characterId:input.characterId});
    expect(mocks.syncRefs.mock.invocationCallOrder[0]).toBeLessThan(mocks.getRefs.mock.invocationCallOrder[0]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/characters/${input.characterId}/builder`);
  });
  it("does not read refs or revalidate after an RPC error and permits retry",async()=>{
    mocks.syncRefs.mockRejectedValueOnce(new Error("private backend detail"));
    await expect(reconcileClassFeatureRefsAction({characterId:input.characterId})).resolves.toEqual({status:"error",message:"Saved class features could not be restored. Please try again."});
    expect(mocks.getRefs).not.toHaveBeenCalled();expect(mocks.revalidatePath).not.toHaveBeenCalled();
    await expect(reconcileClassFeatureRefsAction({characterId:input.characterId})).resolves.toMatchObject({status:"success"});
  });
});
