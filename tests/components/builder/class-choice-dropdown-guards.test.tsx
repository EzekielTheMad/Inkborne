import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoiceCardASI } from "@/components/builder/class-step-rail/choice-card-asi";
import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";
import { ChoiceCardFightingStyle } from "@/components/builder/class-step-rail/choice-card-fighting-style";
import { ChoiceCardFavoredEnemy } from "@/components/builder/class-step-rail/choice-card-favored-enemy";
import { HpPicker } from "@/components/builder/class-step-rail/hp-picker";
import { ClassStepRail } from "@/components/builder/class-step-rail";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices } from "@/lib/types/character";

const scores = { strength: 19, dexterity: 20, constitution: 18, intelligence: 20, wisdom: 20, charisma: 20 };
const enemyOptions = { enemy_types: ["beast", "dragon", "fiend"], humanoid_races: ["elf", "orc", "human"] };
function content(slug: string, name: string, content_type: ContentEntry["content_type"], data: Record<string, unknown>): ContentEntry {
  return { id: slug, slug, name, content_type, data, version: 1, source: "srd", effects: [] };
}

describe("Class choice dropdown guards", () => {
  it("omits capped ASI scores and excludes the first split ability from the second dropdown", () => {
    const onSelect = vi.fn();
    render(<ChoiceCardASI featureSlug="fighter-asi-4" currentChoice={undefined} abilityScores={scores} feats={[]} onSelect={onSelect} />);
    const single = screen.getByRole("combobox", { name: "Ability to increase by 2" });
    expect(within(single).getAllByRole("option").map(option => option.getAttribute("value"))).toEqual(["", "constitution"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Ability increase" }), { target: { value: "split" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Ability 1 to increase by 1" }), { target: { value: "strength" } });
    const second = screen.getByRole("combobox", { name: "Ability 2 to increase by 1" });
    expect(within(second).queryByRole("option", { name: "STR +1" })).not.toBeInTheDocument();
    expect(within(second).queryByRole("option", { name: "DEX +1" })).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.change(second, { target: { value: "constitution" } });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ mode: "asi", allocations: [{ ability: "strength", amount: 1 }, { ability: "constitution", amount: 1 }] });
  });

  it("fails closed when pre-improvement scores are unknown while preserving the saved allocation and feat path", () => {
    const onSelect = vi.fn();
    render(<ChoiceCardASI featureSlug="fighter-asi-4" currentChoice={{ mode: "asi", allocations: [{ ability: "strength", amount: 2 }] }} feats={[]} onSearch={vi.fn().mockResolvedValue([])} onSelect={onSelect} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ability scores for this improvement are unavailable");
    expect(screen.getByText("Saved improvement: STR +2")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Ability to increase by 2" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Feat" })).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("preserves an unavailable saved feat version visibly and offers only eligible versions", () => {
    const onSelect = vi.fn();
    render(<ChoiceCardASI featureSlug="fighter-asi-4" abilityScores={scores} currentChoice={{ mode: "feat", featId: "old-feat", featName: "Retained feat", featVersion: 2 }}
      feats={[{ id: "old-feat", name: "Retained feat", description: "Saved description.", version: 2, source: "platform", scope: "platform", prerequisiteMet: false, prerequisiteReason: "Requires an unavailable ability score" },
        { id: "eligible-feat", name: "Eligible feat", description: "A valid feat.", version: 3, source: "platform", scope: "platform", prerequisiteMet: true, prerequisiteReason: null }]} onSelect={onSelect} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Retained feat");
    expect(screen.getByText("Saved description.")).toBeVisible();
    const select = screen.getByRole("combobox", { name: "Available feat" });
    expect(select).toHaveValue("");
    expect(within(select).queryByRole("option", { name: /Retained feat/ })).not.toBeInTheDocument();
    expect(within(select).getByRole("option", { name: /Eligible feat.*v3/ })).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not persist an invalid retained split while its other ability still needs replacement", () => {
    const onSelect = vi.fn();
    render(<ChoiceCardASI featureSlug="fighter-asi-4" abilityScores={scores} currentChoice={{ mode: "asi", allocations: [{ ability: "dexterity", amount: 1 }, { ability: "wisdom", amount: 1 }] }} feats={[]} onSelect={onSelect} />);
    expect(screen.getByRole("alert")).toHaveTextContent("saved improvement is unavailable");
    fireEvent.change(screen.getByRole("combobox", { name: "Ability 1 to increase by 1" }), { target: { value: "strength" } });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "Ability 2 to increase by 1" }), { target: { value: "constitution" } });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("locks controls during an ASI save and preserves the old choice after a rejected save", async () => {
    let rejectSave!: (error: Error) => void;
    const onSelect = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
    render(<ChoiceCardASI featureSlug="fighter-asi-4" abilityScores={scores}
      currentChoice={{ mode: "asi", allocations: [{ ability: "constitution", amount: 2 }] }} feats={[]} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Ability increase" }), { target: { value: "split" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Ability 1 to increase by 1" }), { target: { value: "strength" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Ability 2 to increase by 1" }), { target: { value: "constitution" } });
    expect(screen.getByText("Saving")).toBeVisible();
    for (const select of screen.getAllByRole("combobox")) expect(select).toBeDisabled();
    await act(async () => { rejectSave(new Error("The change could not be saved.")); });
    expect(screen.getByRole("alert")).toHaveTextContent("The change could not be saved.");
    expect(screen.getByText("Saved improvement: CON +2")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Ability increase" })).toBeEnabled();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("retains a foreign saved subclass with an alert and exposes only exact-parent options", () => {
    const onSelect = vi.fn();
    render(<ChoiceCardSubclass classSlug="fighter" currentSelection="foreign" onSelect={onSelect} subclasses={[
      content("champion", "Champion", "subclass", { parent_class: "fighter", description: "Martial excellence." }),
      content("foreign", "Foreign school", "subclass", { parent_class: "wizard" }),
    ]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("foreign");
    expect(screen.queryByRole("option", { name: "Foreign school" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Subclass" })).toHaveValue("");
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "Subclass" }), { target: { value: "champion" } });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("champion");
  });

  it("keeps unavailable fighting styles saved and shows the selected offered description", () => {
    const onSelect = vi.fn();
    const props = { featureSlug: "fighter-style", classSlug: "fighter", onSelect,
      styleOptions: [content("defense", "Fighting Style: Defense", "feature", { description: "Armor training." })] };
    const view = render(<ChoiceCardFightingStyle {...props} currentStyleSlug="archery" />);
    expect(screen.getByRole("alert")).toHaveTextContent("archery");
    expect(screen.queryByRole("option", { name: "Archery" })).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    view.rerender(<ChoiceCardFightingStyle {...props} currentStyleSlug="defense" />);
    expect(screen.getByText("Armor training.")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Fighting style" })).toHaveValue("defense");
  });

  it("filters other earned enemy types and humanoids, preserves unavailable values, and saves only a complete replacement", () => {
    const onSelect = vi.fn();
    render(<ChoiceCardFavoredEnemy featureSlug="ranger-enemy-6" label="Greater favored enemy" options={enemyOptions} availableLanguages={["elvish"]}
      value={{ selection: { mode: "type", enemy_type: "beast" }, language: null }}
      otherChoices={[{ selection: { mode: "type", enemy_type: "beast" }, language: null }, { selection: { mode: "humanoids", races: ["elf", "orc"] }, language: null }]} onSelect={onSelect} />);
    const select = screen.getByRole("combobox", { name: "Favored enemy" });
    expect(within(select).queryByRole("option", { name: "Beast" })).not.toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Two humanoid races" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Beast");
    expect(screen.getByRole("button", { name: "Save favored enemy" })).toBeDisabled();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: "dragon" } });
    fireEvent.click(screen.getByRole("button", { name: "Save favored enemy" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ selection: { mode: "type", enemy_type: "dragon" }, language: null });
  });

  it("does not dispatch the manual draft when focus moves to a different HP method", () => {
    const onChange = vi.fn();
    render(<HpPicker classSlug="fighter" level={2} hitDie={10} conMod={2} isFirstLevelOfPrimary={false} hpRule="free_choice" storedRoll={{ method: "manual", value: 3 }} onChange={onChange} />);
    const method = screen.getByRole("combobox", { name: "Hit point method" });
    const manual = screen.getByRole("spinbutton", { name: "Manual HP value" });
    fireEvent.change(manual, { target: { value: "4" } });
    fireEvent.blur(manual, { relatedTarget: method });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(method, { target: { value: "average" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ method: "average", value: 6 });
  });

  it("shows unavailable favored-enemy language and empty selection without silently clearing either", () => {
    const onSelect = vi.fn();
    render(<ChoiceCardFavoredEnemy featureSlug="enemy" label="Favored Enemy" options={enemyOptions} availableLanguages={["elvish"]}
      value={{ selection: { mode: "type", enemy_type: "" }, language: "missing-language" }} onSelect={onSelect} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Missing Language");
    expect(screen.getByRole("button", { name: "Save favored enemy" })).toBeDisabled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("passes the exact feature's pre-improvement scores from the rail into the ASI dropdown", () => {
    const fighter = content("fighter", "Fighter", "class", { hit_die: 10, levels: [{ level: 4, features: ["fighter-asi-4"] }] });
    render(<ClassStepRail classes={[fighter]} subclasses={[]}
      features={[content("fighter-asi-4", "Ability Score Improvement", "feature", { feature_type: "asi" })]}
      selectedClasses={[{ slug: "fighter", level: 4 }]} localChoices={{}} resolvedStats={{ constitution: 20 }}
      asiAbilityScores={{ "fighter-asi-4": scores, unrelated: { ...scores, strength: 10 } }} hpRule="free_choice" hpRolls={{}}
      onLevelChange={vi.fn()} onRemoveClass={vi.fn()} onSubclassSelect={vi.fn()} onAsiSelect={vi.fn()} onFightingStyleSelect={vi.fn()} onChoiceSelect={vi.fn()}
      onAddClass={vi.fn()} onConfirmLevelUp={vi.fn()} onCancelLevelUp={vi.fn()} onHpRollChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Ability to increase by 2" });
    expect(within(select).getByRole("option", { name: "CON +2" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "STR +2" })).not.toBeInTheDocument();
  });

  it("reserves only earned valid favored-enemy definitions when the rail builds dropdown eligibility", () => {
    const ranger = content("ranger", "Ranger", "class", { hit_die: 10, levels: [
      { level: 1, features: ["enemy-1"] }, { level: 6, features: ["enemy-6"] }, { level: 14, features: ["enemy-14"] },
    ] });
    const choices: CharacterChoices = { classes: [{ slug: "ranger", level: 6, subclass: "foreign" }], favored_enemies: {
      "enemy-1": { selection: { mode: "type", enemy_type: "beast" }, language: null },
      "enemy-14": { selection: { mode: "type", enemy_type: "dragon" }, language: null },
      "foreign-enemy": { selection: { mode: "type", enemy_type: "fiend" }, language: null },
      arbitrary: { selection: { mode: "type", enemy_type: "dragon" }, language: null },
    } };
    render(<ClassStepRail classes={[ranger]} subclasses={[content("foreign", "Foreign subclass", "subclass", { parent_class: "wizard", levels: [{ level: 1, features: ["foreign-enemy"] }] })]}
      features={["enemy-1", "enemy-6", "enemy-14", "foreign-enemy"].map(slug => content(slug, "Favored Enemy", "feature", { feature_type: "favored_enemy", favored_enemy: enemyOptions }))}
      selectedClasses={choices.classes!} localChoices={choices} resolvedStats={{ constitution: 14 }} hpRule="free_choice" hpRolls={{}}
      onLevelChange={vi.fn()} onRemoveClass={vi.fn()} onSubclassSelect={vi.fn()} onAsiSelect={vi.fn()} onFightingStyleSelect={vi.fn()} onChoiceSelect={vi.fn()}
      availableLanguages={[]} onFavoredEnemySelect={vi.fn()} onAddClass={vi.fn()} onConfirmLevelUp={vi.fn()} onCancelLevelUp={vi.fn()} onHpRollChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Favored enemy" });
    expect(within(select).queryByRole("option", { name: "Beast" })).not.toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Dragon" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Fiend" })).toBeInTheDocument();
  });
});
