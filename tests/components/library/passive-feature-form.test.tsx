import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapPassiveFeatureCreate, mapPassiveFeatureEdit } from "@/lib/homebrew/passive-feature-form";
import { extendedFeatureData, passiveFeatureData, passiveFeatureId as ID } from "@/tests/fixtures/passive-features";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), push: vi.fn() }));
vi.mock("@/app/(app)/homebrew/features/actions", () => ({ createHomebrewPassiveFeature: mocks.create, updateHomebrewPassiveFeature: mocks.update }));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), useRouter: () => ({ push: mocks.push }) }));
import { PassiveFeatureForm } from "@/components/library/passive-feature-form";
const initial = { id: ID, name: "Lantern Cadence", version: 1, data: passiveFeatureData };
function complete() {
  for (const [label, value] of [["Name", "Draft Lantern"], ["Description", "  Original draft description.\n"], ["Class slug", "workshop-scout"], ["Subclass slug (optional)", ""], ["Gain level", "3"]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function submit(mode: "create" | "edit" = "create") { const form = screen.getByRole("button", { name: mode === "create" ? "Create private passive feature" : "Save new version" }).closest("form")!; fireEvent.submit(form); return form; }
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ status: "error", message: "Synthetic validation result." }); mocks.update.mockResolvedValue({ status: "error", message: "Synthetic validation result." }); });
describe("standalone private PassiveFeatureForm", () => {
  it("uses finite blank controls and explicit unverified/no-attachment/no-grant disclosure", () => {
    render(<PassiveFeatureForm mode="create" />);
    for (const label of ["Name", "Description", "Class slug", "Subclass slug (optional)", "Gain level"]) expect(screen.getByLabelText(label)).toHaveValue("");
    expect(screen.getByLabelText("Gain level")).toBeRequired(); expect(screen.getByText(/does not attach it to a class or subclass, grant it to a character/)).toBeVisible();
    expect(screen.queryByLabelText(/effects|counters|choices|owner|scope|system|relations|type/i)).not.toBeInTheDocument();
  });
  it("maps real named create controls, original text and null subclass, preserves reset/error focus", async () => {
    mocks.create.mockImplementation(async (_previous, input: FormData) => {
      expect(mapPassiveFeatureCreate(input)).toMatchObject({ success: true, data: { description: "  Original draft description.\n", class: "workshop-scout", subclass: null, level: 3 } });
      return { status: "error", message: "Check description.", fieldErrors: { description: ["Original synthetic description error."] } };
    });
    render(<PassiveFeatureForm mode="create" />); complete(); const form = submit(); await screen.findByRole("alert"); fireEvent.reset(form);
    expect(screen.getByLabelText("Description")).toHaveValue("  Original draft description.\n"); await waitFor(() => expect(screen.getByLabelText("Description")).toHaveFocus());
    expect(mocks.push).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Create private passive feature" })).toBeEnabled();
  });
  it.each([{ value: null }, { value: undefined }, { value: { status: "idle" } }, { value: { status: "error" } },
    { value: { status: "saved", id: "bad", version: 1, operation: "create" } }, { value: { status: "saved", id: ID, version: 99, operation: "create" } }])("invalid create response $value retains draft and requires manual check acknowledgement", async ({ value }) => {
    mocks.create.mockResolvedValue(value); render(<PassiveFeatureForm mode="create" />); complete(); const form = submit(); await screen.findByRole("alert"); fireEvent.reset(form);
    expect(screen.getByLabelText("Name")).toHaveValue("Draft Lantern"); expect(screen.getByLabelText("Gain level")).toHaveValue("3");
    expect(screen.getByRole("link", { name: "Check Homebrew" })).toHaveAttribute("href", "/homebrew"); expect(screen.getByRole("button", { name: "Create private passive feature" })).toBeDisabled();
    fireEvent.submit(form); expect(mocks.create).toHaveBeenCalledTimes(1); expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I checked Homebrew; allow another create" })); expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Create private passive feature" })).toBeEnabled(); fireEvent.submit(form);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2)); await waitFor(() => expect(screen.getByRole("button", { name: "Create private passive feature" })).toBeDisabled());
  });
  it("actual rejected Promise keeps a create draft without automatic retry or rollback assertion", async () => {
    mocks.create.mockRejectedValue(new Error("Synthetic lost response after a possible save.")); render(<PassiveFeatureForm mode="create" />); complete(); const form = submit();
    await screen.findByRole("alert"); fireEvent.reset(form); expect(screen.getByRole("alert")).toHaveTextContent(/feature may already have saved/);
    expect(screen.getByLabelText("Class slug")).toHaveValue("workshop-scout"); expect(mocks.create).toHaveBeenCalledTimes(1); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("received saved identity persists across navigation failure and prevents another insert", async () => {
    mocks.create.mockResolvedValue({ status: "saved", id: ID, version: 1, operation: "create" }); mocks.push.mockImplementation(() => { throw new Error("Synthetic route failure."); });
    render(<PassiveFeatureForm mode="create" />); complete(); const form = submit(); await screen.findByRole("status");
    expect(screen.getByRole("status")).toHaveTextContent("Feature saved as version 1"); expect(mocks.push).toHaveBeenCalledWith(`/homebrew?created=${ID}`);
    fireEvent.submit(form); expect(mocks.create).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Create private passive feature" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "I checked Homebrew; allow another create" })).not.toBeInTheDocument();
  });
  it("blocks pending duplicate submissions before invoking a second action", async () => {
    let finish!: (value: unknown) => void; mocks.create.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<PassiveFeatureForm mode="create" />); complete(); const form = submit(); await screen.findByRole("button", { name: "Saving…" });
    fireEvent.submit(form); expect(mocks.create).toHaveBeenCalledTimes(1); expect(screen.getByLabelText("Name")).toBeDisabled();
    await act(async () => finish({ status: "error", message: "Pending response released." })); expect(screen.getByLabelText("Description")).toHaveValue("  Original draft description.\n");
  });
  it("existing outside-vocabulary associations/mechanics are read-only and absent subclass is explicit", async () => {
    mocks.update.mockImplementation(async (_previous, input: FormData) => {
      expect([...input.keys()].sort()).toEqual(["description", "expected_version", "id", "name"]);
      expect(mapPassiveFeatureEdit(input)).toMatchObject({ success: true, data: { id: ID, expected_version: 1, description: "New original text." } });
      return { status: "error", message: "Synthetic editable text response." };
    });
    render(<PassiveFeatureForm mode="edit" initialValue={{ ...initial, data: extendedFeatureData }} />);
    expect(screen.getByRole("region", { name: "Read-only feature association" })).toHaveTextContent("Legacy workshop label / unverified");
    expect(screen.getByText("Not present")).toBeVisible(); expect(screen.getByText("choice", { exact: true })).toBeVisible();
    expect(screen.queryByLabelText("Class slug")).not.toBeInTheDocument(); expect(screen.queryByLabelText("Gain level")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "New original text." } }); submit("edit"); await screen.findByRole("alert");
  });
  it.each([{ response: { status: "conflict", message: "Reload after a conflict." } }, { response: undefined },
    { response: { status: "saved", id: ID, version: 1, operation: "edit" } }])("edit conflict/missing/changed-old-version response requires reload and keeps draft $response", async ({ response }) => {
    mocks.update.mockResolvedValue(response); render(<PassiveFeatureForm mode="edit" initialValue={initial} />);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Retained original edit." } }); const form = submit("edit"); await screen.findByRole("alert"); fireEvent.reset(form);
    expect(screen.getByLabelText("Description")).toHaveValue("Retained original edit."); expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeEnabled(); fireEvent.submit(form); expect(mocks.update).toHaveBeenCalledTimes(1); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("actual rejected edit Promise requires reload with no automatic resubmission", async () => {
    mocks.update.mockRejectedValue(new Error("Synthetic lost update response.")); render(<PassiveFeatureForm mode="edit" initialValue={initial} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Retained edit name" } }); const form = submit("edit"); await screen.findByRole("alert");
    fireEvent.reset(form); expect(screen.getByLabelText("Name")).toHaveValue("Retained edit name"); expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled(); expect(mocks.update).toHaveBeenCalledTimes(1);
  });
  it("genuine unchanged state keeps editing open and navigates nowhere", async () => {
    mocks.update.mockResolvedValue({ status: "unchanged", id: ID, version: 1, message: "No changes to save." }); render(<PassiveFeatureForm mode="edit" initialValue={initial} />);
    submit("edit"); await screen.findByRole("status"); expect(screen.getByRole("status")).toHaveTextContent("Version 1 is unchanged"); expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save new version" })).toBeEnabled();
  });
});
