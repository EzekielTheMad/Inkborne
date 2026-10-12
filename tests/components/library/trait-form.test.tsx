import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { traitDataSchema } from "@/lib/schemas/content-types/trait";
import { mapHomebrewTraitFormData } from "@/lib/homebrew/trait-form";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), push: vi.fn() }));
vi.mock("@/app/(app)/homebrew/traits/actions", () => ({ createHomebrewTrait: mocks.create, updateHomebrewTrait: mocks.update }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
import { TraitForm } from "@/components/library/trait-form";
const ID = "33333333-3333-4333-8333-333333333333";
function complete() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Draft Lantern" } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Original synthetic draft text." } });
  fireEvent.change(screen.getByLabelText("Uses"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Recovery"), { target: { value: "short rest" } });
}
function submit(label = "Create private trait") {
  const form = screen.getByRole("button", { name: label }).closest("form")!;
  fireEvent.submit(form); return form;
}
beforeEach(() => { mocks.create.mockReset(); mocks.update.mockReset(); mocks.push.mockReset(); });
describe("standalone TraitForm", () => {
  it("offers finite fields with standalone disclosure and no unsupported controls", () => {
    render(<TraitForm mode="create" />);
    expect(screen.getByLabelText("Name")).toBeRequired(); expect(screen.getByLabelText("Description")).toBeRequired();
    expect(screen.getByLabelText("Uses")).toHaveValue("");
    expect(screen.getByText(/does not attach the trait to a race or apply it to a character/)).toBeVisible();
    expect(screen.queryByLabelText(/relations|races|subraces|effects|owner|scope|system|extra/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Dawn" })).not.toBeInTheDocument();
  });
  it("uses actual named controls, preserves drafts/native reset and focuses invalid fields", async () => {
    mocks.create.mockImplementation(async (_previous, form: FormData) => {
      expect(mapHomebrewTraitFormData(form, true)).toMatchObject({ success: true, data: { resource: { usages: 2, recovery: "short rest" } } });
      return { status: "error", message: "Check the fields.", fieldErrors: { description: ["Synthetic description error."] } };
    });
    render(<TraitForm mode="create" />); complete(); const form = submit();
    await screen.findByRole("alert"); fireEvent.reset(form);
    expect(screen.getByLabelText("Description")).toHaveValue("Original synthetic draft text.");
    expect(screen.getByLabelText("Uses")).toHaveValue("2");
    await waitFor(() => expect(screen.getByLabelText("Description")).toHaveFocus());
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it.each([null, undefined, { status: "idle" }, { status: "saved", id: "malformed" }, { status: "unknown" }, { status: "uncertain", message: "Unconfirmed save; check Homebrew." }])("missing/malformed/uncertain CREATE response %j keeps draft and requires explicit acknowledgement", async response => {
    mocks.create.mockResolvedValue(response); render(<TraitForm mode="create" />); complete(); const form = submit();
    await screen.findByRole("alert"); fireEvent.reset(form);
    expect(screen.getByLabelText("Name")).toHaveValue("Draft Lantern"); expect(screen.getByLabelText("Recovery")).toHaveValue("short rest");
    expect(screen.getByRole("link", { name: "Check Homebrew" })).toHaveAttribute("href", "/homebrew");
    expect(screen.getByRole("button", { name: "Create private trait" })).toBeDisabled();
    fireEvent.submit(form); expect(mocks.create).toHaveBeenCalledOnce(); expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I checked Homebrew; allow another create" }));
    expect(mocks.create).toHaveBeenCalledOnce(); expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create private trait" })).toBeEnabled();
    fireEvent.submit(form); await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create private trait" })).toBeDisabled());
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("transport loss after simulated saved INSERT causes no automatic second creation or confirmation", async () => {
    mocks.create.mockRejectedValue(new Error("Simulated save succeeded but its response was lost."));
    render(<TraitForm mode="create" />); complete(); submit(); await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent(/trait may already have saved/);
    expect(screen.getByRole("button", { name: "Create private trait" })).toBeDisabled(); expect(mocks.create).toHaveBeenCalledOnce(); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("only a received valid saved state permits navigation; confirmation prevents repeat submit", async () => {
    mocks.create.mockResolvedValue({ status: "saved", id: ID }); render(<TraitForm mode="create" />); complete(); const form = submit();
    await screen.findByRole("status"); expect(mocks.push).toHaveBeenCalledWith(`/homebrew?created=${ID}`);
    fireEvent.submit(form); expect(mocks.create).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Create private trait" })).toBeDisabled();
  });
  it.each(["conflict", "uncertain"])("edit %s retains native draft and requires explicit reload", async status => {
    mocks.update.mockResolvedValue({ status, message: "Reload latest before another save." });
    render(<TraitForm mode="edit" initialValue={{ id: ID, name: "Original", version: 3, data: traitDataSchema.parse({ description: "Original text." }), resourceEditable: true }} />);
    complete(); const form = submit("Save new version"); await screen.findByRole("alert"); fireEvent.reset(form);
    expect(screen.getByLabelText("Name")).toHaveValue("Draft Lantern"); expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeEnabled(); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("locks legacy per-level/dawn controls and still submits description without a counter rewrite", async () => {
    mocks.update.mockImplementation(async (_previous, form: FormData) => {
      expect(form.has("usages")).toBe(false); expect(form.has("recovery")).toBe(false);
      return { status: "error", message: "Simulated validation response." };
    });
    render(<TraitForm mode="edit" initialValue={{ id: ID, name: "Original", version: 2, resourceEditable: false,
      data: traitDataSchema.parse({ description: "Original text.", usages: Array(20).fill(2), recovery: "dawn" }) }} />);
    expect(screen.getByLabelText("Uses")).toBeDisabled(); expect(screen.getByLabelText("Recovery")).toBeDisabled();
    expect(screen.getByText(/Uses by level 1–20/)).toBeVisible(); expect(screen.getByText(/currently recover on a long rest/)).toBeVisible();
    submit("Save new version"); await screen.findByRole("alert");
  });
  it("safe integer edit controls roundtrip without guessed zeros", async () => {
    mocks.update.mockImplementation(async (_previous, form: FormData) => {
      expect(mapHomebrewTraitFormData(form, true)).toMatchObject({ success: true, data: { resource: { usages: Number.MAX_SAFE_INTEGER, recovery: "long rest" } } });
      return { status: "error", message: "Synthetic safe-value response." };
    });
    render(<TraitForm mode="edit" initialValue={{ id: ID, name: "Original", version: 2, resourceEditable: true,
      data: traitDataSchema.parse({ description: "Original text.", usages: Number.MAX_SAFE_INTEGER, recovery: "long rest" }) }} />);
    expect(screen.getByLabelText("Uses")).toHaveValue(Number.MAX_SAFE_INTEGER.toString()); submit("Save new version"); await screen.findByRole("alert");
  });
});
