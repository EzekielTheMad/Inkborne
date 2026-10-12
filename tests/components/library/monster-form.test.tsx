import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/app/(app)/homebrew/monsters/actions", () => ({ createHomebrewMonster: actions.create, updateHomebrewMonster: actions.update }));
import { MonsterForm } from "@/components/library/monster-form";
import { mapHomebrewMonsterFormData } from "@/lib/homebrew/monster-form";
import { cinderlitKite, lanternReefRegent } from "@/tests/fixtures/monsters";
const initial = { id: "33333333-3333-4333-8333-333333333333", name: "Original Kite", version: 1, data: cinderlitKite };
beforeEach(() => { vi.clearAllMocks(); actions.update.mockResolvedValue({ status: "idle", message: "No changes to save." }); });
function submit() { fireEvent.submit(screen.getByRole("button", { name: "Save new version" }).closest("form")!); }
describe("normal structured MonsterForm", () => {
  it("starts with blank required fields, normal controls and no guessed mechanics/JSON editor", () => {
    render(<MonsterForm mode="create" />);
    for (const label of ["Name", "Creature type", "Declared AC", "Declared HP average", "Strength score"]) expect(screen.getByLabelText(label)).toHaveValue("");
    expect(screen.getByLabelText("Size")).toHaveValue("");
    expect(screen.queryByRole("textbox", { name: /json|effects|owner|version|system/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Actions per round (optional)")).not.toBeInTheDocument();
    expect(screen.getByText(/dice text is displayed/)).toBeVisible();
    fireEvent.submit(screen.getByRole("button", { name: "Create private monster" }).closest("form")!);
    expect(actions.create).not.toHaveBeenCalled(); expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields");
  });
  it("round trips all format-one fields through actual controls and mapper", async () => {
    actions.update.mockImplementation(async (_state, input: FormData) => {
      expect(mapHomebrewMonsterFormData(input, "edit")).toMatchObject({ success: true, value: { data: lanternReefRegent, changedFields: [] } });
      return { status: "error", message: "Simulated recoverable response." };
    });
    render(<MonsterForm mode="edit" initialValue={{ ...initial, data: lanternReefRegent }} />);
    expect(screen.getByLabelText("Lair initiative (optional)")).toHaveValue("0");
    expect(screen.getByLabelText("Hover (optional)")).toHaveValue("false");
    submit(); await screen.findByText("Simulated recoverable response.");
    expect(screen.getByLabelText("Lair initiative (optional)")).toHaveValue("0");
  });
  it("uses ordered duplicate rows with keyboard buttons and no leaked UI IDs", async () => {
    actions.update.mockImplementation(async (_state, input: FormData) => {
      const parsed = mapHomebrewMonsterFormData(input, "edit");
      expect(parsed).toMatchObject({ success: true, value: { changedFields: ["traits"], data: { traits: [{ name: "Echo", description: "Second." }, { name: "Echo", description: "First." }] } } });
      return { status: "idle", message: "Draft inspected." };
    });
    render(<MonsterForm mode="edit" initialValue={{ ...initial, data: { ...cinderlitKite, traits: [{ name: "Echo", description: "First." }, { name: "Echo", description: "Second." }] } }} />);
    expect(screen.getByRole("button", { name: "Move Traits 1 up" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move Traits 2 up" })); submit(); await screen.findByText("Draft inspected.");
    const descriptions = screen.getAllByLabelText("Entry description");
    expect(descriptions[0]).toHaveValue("Second.");
  });
  it("explicitly adds, removes and clears optional groups while preserving present-empty", async () => {
    render(<MonsterForm mode="edit" initialValue={{ ...initial, data: { ...cinderlitKite, languages: [] } }} />);
    expect(screen.getByLabelText("Include languages")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Add language" }));
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "Lantern signs" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove Languages 1" }));
    const element = screen.getByRole("button", { name: "Save new version" }).closest("form")!;
    expect(mapHomebrewMonsterFormData(new FormData(element), "edit")).toMatchObject({ success: true, value: { data: { languages: [] } } });
    fireEvent.click(screen.getByLabelText("Include languages"));
    const parsed = mapHomebrewMonsterFormData(new FormData(element), "edit");
    expect(parsed).toMatchObject({ success: true, value: { changedFields: ["languages"] } });
    if (parsed.success) expect(parsed.value.data).not.toHaveProperty("languages");
  });
  it("reveals/focuses invalid optional control, rejects exponent syntax and keeps draft", () => {
    render(<MonsterForm mode="edit" initialValue={initial} />);
    fireEvent.change(screen.getByLabelText("Walk (ft.) (optional)"), { target: { value: "1e2" } }); submit();
    expect(actions.update).not.toHaveBeenCalled(); expect(screen.getByLabelText("Walk (ft.) (optional)")).toHaveFocus();
    expect(screen.getByLabelText("Walk (ft.) (optional)")).toHaveValue("1e2");
  });
  it("retains recoverable draft, exposes canonical preview and locks conflict retries until explicit reload", async () => {
    actions.update.mockResolvedValue({ status: "conflict", message: "Reload latest before saving again." });
    render(<MonsterForm mode="edit" initialValue={initial} />);
    fireEvent.change(screen.getByLabelText("Creature type"), { target: { value: "lantern construct" } });
    submit(); await screen.findByRole("alert");
    expect(screen.getByLabelText("Creature type")).toHaveValue("lantern construct");
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeEnabled();
    expect(screen.getByText(/discards this unsaved draft/)).toBeVisible();
    expect(screen.getByLabelText("Monster stat block")).toBeInTheDocument();
  });
  it("pending save prevents duplicate transport and editing", async () => {
    let finish!: (value: { status: "idle"; message: string }) => void;
    actions.update.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<MonsterForm mode="edit" initialValue={initial} />); submit();
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled());
    fireEvent.submit(screen.getByRole("button", { name: "Saving…" }).closest("form")!);
    expect(actions.update).toHaveBeenCalledTimes(1); expect(screen.getByLabelText("Creature type")).toBeDisabled();
    await act(async () => finish({ status: "idle", message: "No changes to save." }));
    expect(screen.getByLabelText("Creature type")).toHaveValue("construct");
  });
});
