import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { magicItemDataSchema } from "@/lib/schemas/content-types/magic-item";

const actions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", async () => ({ ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")), useRouter: () => ({ push: actions.push }) }));
vi.mock("@/app/(app)/homebrew/magic-items/actions", () => ({
  createHomebrewMagicItem: actions.create,
  updateHomebrewMagicItem: actions.update,
}));

import { MagicItemForm } from "@/components/library/magic-item-form";
const ID = "11111111-1111-4111-8111-111111111111";
function initial(version = 1, id = ID) { return { id, name: "Synthetic Compass", version, data: magicItemDataSchema.parse({ description: "Original narrative." }) }; }
function fill() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Kept Compass" } });
  fireEvent.change(screen.getByLabelText("Magic item description"), { target: { value: "Kept narrative." } });
}
function form() { return screen.getByLabelText("Name").closest("form")!; }
function submit() { fireEvent.submit(form()); }
beforeEach(() => { vi.resetAllMocks(); actions.create.mockResolvedValue({ status: "error", message: "Original field refusal." }); actions.update.mockResolvedValue({ status: "error", message: "Original field refusal." }); });

describe("MagicItemForm", () => {
  it("renders accessible finite fields without envelope or raw effect controls", () => {
    render(<MagicItemForm mode="create" />);

    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Rarity")).toHaveValue("Common");
    expect(screen.getByLabelText("Magic item description")).toBeRequired();
    expect(screen.getByLabelText("Equipment category")).toHaveValue("");
    expect(screen.getByLabelText("Requires attunement")).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Create private magic item" }),
    ).toBeVisible();
    expect(screen.queryByLabelText(/effects|owner|scope|system/i)).not.toBeInTheDocument();
  });

  it("renders edit defaults and immutable-version guidance", () => {
    render(
      <MagicItemForm
        mode="edit"
        initialValue={{
          id: "11111111-1111-4111-8111-111111111111",
          name: "Oathbound Compass",
          version: 2,
          data: magicItemDataSchema.parse({
            rarity: "Rare",
            description: "It points toward your last promise.",
            equipment_category: "Wondrous item",
            requires_attunement: true,
          }),
        }}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Oathbound Compass");
    expect(screen.getByLabelText("Rarity")).toHaveValue("Rare");
    expect(screen.getByLabelText("Equipment category")).toHaveValue("Wondrous item");
    expect(screen.getByLabelText("Requires attunement")).toBeChecked();
    expect(screen.getByText(/changes create a new immutable version/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save new version" })).toBeVisible();
  });

  it("retains authored values when React resets after validation", () => {
    const view = render(<MagicItemForm mode="create" />);
    const name = screen.getByLabelText("Name");
    const rarity = screen.getByLabelText("Rarity");
    const description = screen.getByLabelText("Magic item description");
    const category = screen.getByLabelText("Equipment category");
    const attunement = screen.getByLabelText("Requires attunement");

    fireEvent.change(name, { target: { value: "Lantern of Returning" } });
    fireEvent.change(rarity, { target: { value: "Very Rare" } });
    fireEvent.change(description, { target: { value: "It remembers every road home." } });
    fireEvent.change(category, { target: { value: "Wondrous item" } });
    fireEvent.click(attunement);

    const form = screen
      .getByRole("button", { name: "Create private magic item" })
      .closest("form");
    expect(form).not.toBeNull();
    fireEvent.reset(form!);
    view.rerender(<MagicItemForm mode="create" />);

    expect(name).toHaveValue("Lantern of Returning");
    expect(rarity).toHaveValue("Very Rare");
    expect(description).toHaveValue("It remembers every road home.");
    expect(category).toHaveValue("Wondrous item");
    expect(attunement).toBeChecked();
  });

  it("retains all fields after a real action settles and native form reset runs", async () => {
    actions.create.mockResolvedValue({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { name: ["Validation failed."] },
    });
    render(<MagicItemForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Lantern of Returning" } });
    fireEvent.change(screen.getByLabelText("Rarity"), { target: { value: "Very Rare" } });
    fireEvent.change(screen.getByLabelText("Magic item description"), { target: { value: "It remembers every road home." } });
    fireEvent.change(screen.getByLabelText("Equipment category"), { target: { value: "Wondrous item" } });
    fireEvent.click(screen.getByLabelText("Requires attunement"));
    const form = screen.getByRole("button", { name: "Create private magic item" }).closest("form")!;
    const nativeResets: Event[] = [];
    form.addEventListener("reset", event => { nativeResets.push(event); });
    fireEvent.submit(form);
    await screen.findByRole("alert");
    await waitFor(() => expect(actions.create).toHaveBeenCalledOnce());
    const submitted = actions.create.mock.calls[0][1] as FormData;
    expect(submitted.get("rarity")).toBe("Very Rare");
    // React's action settlement invokes HTMLFormElement.reset; unlike
    // fireEvent.reset, this exercises the select's actual native default.
    expect(nativeResets.length).toBeGreaterThan(0);
    expect(nativeResets.every(event => event.defaultPrevented)).toBe(true);
    expect(screen.getByLabelText("Name")).toHaveValue("Lantern of Returning");
    expect(screen.getByLabelText("Rarity")).toHaveValue("Very Rare");
    expect(screen.getByLabelText("Magic item description")).toHaveValue("It remembers every road home.");
    expect(screen.getByLabelText("Equipment category")).toHaveValue("Wondrous item");
    expect(screen.getByLabelText("Requires attunement")).toBeChecked();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("actual-old-export acknowledgment baseline form controls", () => {
  it("unexpected nonblank idle retains create draft and blocks repeat until deliberate acknowledgment", async () => {
    actions.create.mockResolvedValue({ status: "idle", message: "Unexpected idle" }); render(<MagicItemForm mode="create" />); fill(); submit();
    await waitFor(() => expect(actions.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create private magic item" })).toBeDisabled());
    submit(); expect(actions.create).toHaveBeenCalledTimes(1); expect(actions.push).not.toHaveBeenCalled();
    fireEvent.reset(form()); expect(screen.getByLabelText("Name")).toHaveValue("Kept Compass"); expect(screen.getByLabelText("Magic item description")).toHaveValue("Kept narrative.");
    expect(screen.getByRole("link", { name: "Check Homebrew" })).toHaveAttribute("href", "/homebrew");
    expect(screen.getByRole("button", { name: "Create private magic item" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "I checked; allow another create" }));
    actions.create.mockResolvedValue({ status: "error", message: "Check the fields." }); submit();
    await waitFor(() => expect(actions.create).toHaveBeenCalledTimes(2)); expect(screen.getByLabelText("Name")).toHaveValue("Kept Compass");
  });
  it("native pending fieldset and synchronous submit guard block a second queued action", async () => {
    let finish!: (value: unknown) => void; actions.create.mockReturnValue(new Promise(resolve => { finish = resolve; })); render(<MagicItemForm mode="create" />); fill();
    submit(); submit(); await waitFor(() => expect(actions.create).toHaveBeenCalledTimes(1));
    const fieldset = screen.getByRole("group", { name: "Magic item details" }) as HTMLFieldSetElement;
    expect(fieldset.disabled).toBe(true); expect(fieldset).toHaveAttribute("aria-busy", "true"); expect(screen.getByLabelText("Name")).toBeDisabled();
    submit(); await act(async () => finish({ status: "error", message: "Description refused.", fieldErrors: { description: ["Revise this description."] } }));
    expect(actions.create).toHaveBeenCalledTimes(1); expect(screen.getByLabelText("Magic item description")).toHaveFocus(); expect(screen.getByLabelText("Name")).toHaveValue("Kept Compass");
  });
  it("rerendered foreign version never rebases hidden identity onto an old draft", () => {
    const view = render(<MagicItemForm mode="edit" initialValue={initial()} />); fill(); view.rerender(<MagicItemForm mode="edit" initialValue={initial(2)} />);
    expect(form().querySelector('[name="expected_version"]')).toHaveValue("1"); expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled();
    expect(screen.getByLabelText("Name")).toHaveValue("Kept Compass"); submit(); expect(actions.update).not.toHaveBeenCalled();
  });
});

describe("magic-item recovery and mounted acknowledgment", () => {
  it.each([undefined, { id: ID }, { status: "saved", operation: "create", id: "invalid", version: 1 }])("malformed create%j keeps draft without navigation or automatic retry", async response => {
    actions.create.mockResolvedValue(response); render(<MagicItemForm mode="create" />); fill(); submit(); await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Create private magic item" })).toBeDisabled(); submit(); expect(actions.create).toHaveBeenCalledTimes(1); expect(actions.push).not.toHaveBeenCalled(); expect(screen.getByLabelText("Name")).toHaveValue("Kept Compass");
  });
  it("ordinary thrown create is uncertain and bounded summary retains text", async () => {
    actions.create.mockRejectedValue(Error("Lost response")); render(<MagicItemForm mode="create" />); fill(); submit(); await screen.findByRole("alert"); expect(screen.getByRole("button", { name: "I checked; allow another create" })).toBeVisible(); expect(screen.getByLabelText("Magic item description")).toHaveValue("Kept narrative.");
  });
  it.each([{ status: "conflict", message: "Newer eligible version" }, { status: "idle", message: "Unexpected idle" }, { status: "uncertain", message: "Lost edit result" }])("edit%j locks with disclosed reload and mount identity", async response => {
    actions.update.mockResolvedValue(response); render(<MagicItemForm mode="edit" initialValue={initial()} />); fill(); submit(); await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled(); expect(screen.getByRole("button", { name: "Reload latest" })).toBeVisible(); expect(screen.getByText(/Reload discards this unsaved draft/)).toBeVisible();
    expect(form().querySelector('[name="id"]')).toHaveValue(ID); expect(form().querySelector('[name="expected_version"]')).toHaveValue("1"); fireEvent.reset(form()); expect(screen.getByLabelText("Name")).toHaveValue("Kept Compass"); submit(); expect(actions.update).toHaveBeenCalledTimes(1); expect(actions.push).not.toHaveBeenCalled();
  });
  it.each([{ operation: "create", id: ID, version: 2 }, { operation: "edit", id: ID, version: 1 }, { operation: "edit", id: "22222222-2222-4222-8222-222222222222", version: 2 }])("wrong mounted edit saved tuple%j becomes uncertain", async tuple => {
    actions.update.mockResolvedValue({ status: "saved", ...tuple }); render(<MagicItemForm mode="edit" initialValue={initial()} />); fill(); submit(); await screen.findByRole("alert"); expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled(); expect(actions.push).not.toHaveBeenCalled();
  });
  it("retains saved exact pin before ordinary navigation failure and never reinserts", async () => {
    actions.create.mockResolvedValue({ status: "saved", operation: "create", id: ID, version: 1 }); actions.push.mockImplementation(() => { throw Error("Synthetic navigation failure"); });
    render(<MagicItemForm mode="create" />); fill(); submit(); await screen.findByRole("status"); expect(screen.getByRole("status")).toHaveTextContent(`version 1 (${ID})`); expect(screen.getByRole("alert")).toHaveTextContent(/Navigation failed/);
    expect(actions.push).toHaveBeenCalledWith("/homebrew"); expect(screen.getByRole("button", { name: "Create private magic item" })).toBeDisabled(); submit(); expect(actions.create).toHaveBeenCalledTimes(1);
  });
  it("genuine unchanged remains editable using the same mounted version", async () => {
    actions.update.mockResolvedValue({ status: "unchanged", id: ID, version: 1, message: "This invocation did not write." }); render(<MagicItemForm mode="edit" initialValue={initial()} />); fill(); submit(); await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Save new version" })).not.toBeDisabled(); expect(form().querySelector('[name="expected_version"]')).toHaveValue("1"); expect(actions.push).not.toHaveBeenCalled();
  });
});
