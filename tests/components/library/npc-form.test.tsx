import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), unstable_rethrow: () => {} }));
vi.mock("@/app/(app)/homebrew/npcs/actions", () => ({ createHomebrewNpc: mocks.create, updateHomebrewNpc: mocks.update }));
import { NpcForm } from "@/components/library/npc-form";
import { mapNpcForm } from "@/lib/homebrew/npc-form";
import { npcId, originalNpc } from "@/tests/fixtures/npcs";
function submit() { fireEvent.submit(screen.getByRole("button", { name: /Create private NPC|Save new version|Saving…/ }).closest("form")!); }
function transport() { return new FormData(screen.getByRole("button", { name: /Create private NPC|Save new version|Saving…/ }).closest("form")!); }
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ status: "error", message: "Original test refusal." }); mocks.update.mockResolvedValue({ status: "error", message: "Original test refusal." }); });
describe("actual NPC form controlled presence/order/draft", () => {
  it("name-only starts absent; checked empty lists and duplicates/order are explicit", () => {
    render(<NpcForm mode="create" />); fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Original NPC" } });
    expect(JSON.parse(String(transport().get("npc_data")))).toEqual({ schema_version: 1 });
    fireEvent.click(screen.getByLabelText("Include personality")); fireEvent.click(screen.getByLabelText("Include ideals"));
    expect(JSON.parse(String(transport().get("npc_data")))).toEqual({ schema_version: 1, personality: { ideals: [] } });
    fireEvent.click(screen.getByRole("button", { name: "Add ideals" })); fireEvent.change(screen.getByLabelText("Ideals 1"), { target: { value: "same" } });
    fireEvent.click(screen.getByRole("button", { name: "Add ideals" })); fireEvent.change(screen.getByLabelText("Ideals 2"), { target: { value: "same" } });
    expect(JSON.parse(String(transport().get("npc_data"))).personality.ideals).toEqual(["same", "same"]);
    fireEvent.click(screen.getByLabelText("Include ideals")); expect(JSON.parse(String(transport().get("npc_data"))).personality).toEqual({});
    fireEvent.click(screen.getByLabelText("Include ideals")); expect(screen.getByLabelText("Ideals 2")).toHaveValue("same");
  });
  it.each([undefined, { status: "idle", message: "Unexpected idle" }, { status: "saved", id: "bad", version: 1, operation: "create" }])("uncertain create retains native-reset draft and requires manual acknowledgment %j", async response => {
    mocks.create.mockResolvedValue(response); render(<NpcForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Kept NPC" } }); submit(); await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Create private NPC" })).toBeDisabled(); expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.reset(screen.getByLabelText("Name").closest("form")!); expect(screen.getByLabelText("Name")).toHaveValue("Kept NPC");
    submit(); expect(mocks.create).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "I checked Homebrew; allow another create" })); submit(); await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
  });
  it("pending native fieldset blocks a duplicate request; rejected draft retains focus", async () => {
    let finish!: (value: unknown) => void; mocks.create.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<NpcForm mode="create" />); fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Original pending" } }); submit();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1)); submit(); expect(mocks.create).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("Name").closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    await act(async () => finish({ status: "error", message: "Original rejected field", fieldErrors: { name: ["Try another original name"] } }));
    expect(screen.getByLabelText("Name")).toHaveFocus(); expect(screen.getByLabelText("Name")).toHaveValue("Original pending");
  });
  it("saved exact ID navigates plain Homebrew; navigation failure cannot reinsert", async () => {
    mocks.create.mockResolvedValue({ status: "saved", id: npcId(1), version: 1, operation: "create" }); mocks.push.mockImplementation(() => { throw Error("Synthetic navigation failed"); });
    render(<NpcForm mode="create" />); fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Original saved" } }); submit();
    await screen.findByRole("status"); expect(mocks.push).toHaveBeenCalledWith("/homebrew"); submit(); expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("edit conflict retains text and immutable baseline, locking until disclosed reload", async () => {
    mocks.update.mockResolvedValue({ status: "conflict", message: "Newer eligible version" }); render(<NpcForm mode="edit" initialValue={{ id: npcId(1), name: "Original NPC", version: 1, data: originalNpc }} />);
    fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: "Unsaved new text" } }); submit(); await screen.findByRole("alert");
    expect(screen.getByLabelText("Description (optional)")).toHaveValue("Unsaved new text"); expect(transport().get("expected_version")).toBe("1");
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled(); expect(screen.getByRole("button", { name: "Reload latest" })).toBeVisible();
  });
  it("unexpected idle edit remains uncertain/locked until reload with no extra action or navigation", async () => {
    mocks.update.mockResolvedValue({ status: "idle", message: "Unexpected idle" }); render(<NpcForm mode="edit" initialValue={{ id: npcId(1), name: "Original NPC", version: 1, data: originalNpc }} />);
    fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: "Kept idle-edit draft" } }); submit(); await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled(); expect(screen.getByRole("button", { name: "Reload latest" })).toBeVisible();
    fireEvent.reset(screen.getByLabelText("Name").closest("form")!); expect(screen.getByLabelText("Description (optional)")).toHaveValue("Kept idle-edit draft");
    submit(); expect(mocks.update).toHaveBeenCalledTimes(1); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("many malformed edit paths/identity/intent return editable bounded error rather than uncertainty", async () => {
    mocks.update.mockImplementation(async (_previous, incoming: FormData) => {
      incoming.set("npc_data", JSON.stringify({ schema_version: 1, relationships: Array.from({ length: 500 }, () => ({ name: 0, relationship: 0, description: 0 })) }));
      incoming.set("id", "bad"); incoming.set("expected_version", "0"); incoming.set("changed_fields", "{");
      const mapped = mapNpcForm(incoming, "edit"); if (mapped.success) throw Error("Malformed fixture must fail");
      return { status: "error", message: "Original bounded validation refusal", fieldErrors: mapped.fieldErrors };
    });
    render(<NpcForm mode="edit" initialValue={{ id: npcId(1), name: "Original NPC", version: 1, data: originalNpc }} />);
    fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: "Kept validation draft" } }); submit(); await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Save new version" })).not.toBeDisabled();
    expect(screen.getByLabelText("Description (optional)")).toHaveValue("Kept validation draft"); expect(mocks.push).not.toHaveBeenCalled();
  });
});
