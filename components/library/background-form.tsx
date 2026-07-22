"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createHomebrewBackground,
  updateHomebrewBackground,
  type HomebrewBackgroundActionState,
} from "@/app/(app)/library/backgrounds/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BackgroundData } from "@/lib/schemas/content-types/background";

interface BackgroundFormInitialValue {
  id: string;
  name: string;
  version: number;
  data: BackgroundData;
}

interface BackgroundFormProps {
  mode: "create" | "edit";
  initialValue?: BackgroundFormInitialValue;
}

interface BackgroundFormFields {
  name: string;
  featureName: string;
  featureDescription: string;
  skills: string[];
  toolProfs: string;
  fixedLanguages: string;
  languageChoiceCount: string;
  gold: string;
  equipment: string;
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
}

const SKILLS = [
  ["acrobatics", "Acrobatics"],
  ["animal-handling", "Animal Handling"],
  ["arcana", "Arcana"],
  ["athletics", "Athletics"],
  ["deception", "Deception"],
  ["history", "History"],
  ["insight", "Insight"],
  ["intimidation", "Intimidation"],
  ["investigation", "Investigation"],
  ["medicine", "Medicine"],
  ["nature", "Nature"],
  ["perception", "Perception"],
  ["performance", "Performance"],
  ["persuasion", "Persuasion"],
  ["religion", "Religion"],
  ["sleight-of-hand", "Sleight of Hand"],
  ["stealth", "Stealth"],
  ["survival", "Survival"],
] as const;

const emptyState: HomebrewBackgroundActionState = { status: "idle", message: "" };
const textareaClassName =
  "w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FieldErrors({
  state,
  name,
}: {
  state: HomebrewBackgroundActionState;
  name: string;
}) {
  const errors = state.fieldErrors?.[name];
  if (!errors?.length) return null;
  return (
    <p id={`background-${name}-error`} className="text-xs text-destructive">
      {errors.join(" ")}
    </p>
  );
}

function errorAttributes(state: HomebrewBackgroundActionState, name: string) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `background-${name}-error` : undefined,
  } as const;
}

function textList(values: readonly string[] | undefined) {
  return values?.join("\n") ?? "";
}

export function BackgroundForm({ mode, initialValue }: BackgroundFormProps) {
  const action = mode === "create" ? createHomebrewBackground : updateHomebrewBackground;
  const [state, formAction, pending] = useActionState(action, emptyState);
  const data = initialValue?.data;
  const fixedTools = data?.toolProfs.filter((entry): entry is string => typeof entry === "string");
  const fixedLanguages = data?.languageProfs.filter(
    (entry): entry is string => typeof entry === "string",
  );
  const languageChoice = data?.languageProfs.find(
    (entry): entry is { choose: number; from: "any" | string[] } => typeof entry !== "string",
  );
  const [fields, setFields] = useState<BackgroundFormFields>(() => ({
    name: initialValue?.name ?? "",
    featureName: data?.feature.name ?? "",
    featureDescription: data?.feature.description ?? "",
    skills: data?.skills ?? [],
    toolProfs: textList(fixedTools),
    fixedLanguages: textList(fixedLanguages),
    languageChoiceCount: languageChoice ? String(languageChoice.choose) : "",
    gold: typeof data?.gold === "number" ? String(data.gold) : "",
    equipment: data?.equipment ?? "",
    personalityTraits: textList(data?.personality_traits),
    ideals: data?.ideals.map((ideal) => (
      ideal.alignment ? `${ideal.text} | ${ideal.alignment}` : ideal.text
    )).join("\n") ?? "",
    bonds: textList(data?.bonds),
    flaws: textList(data?.flaws),
  }));

  function setField<K extends keyof BackgroundFormFields>(
    key: K,
    value: BackgroundFormFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function toggleSkill(skill: string, checked: boolean) {
    setFields((current) => ({
      ...current,
      skills: checked
        ? [...new Set([...current.skills, skill])]
        : current.skills.filter((entry) => entry !== skill),
    }));
  }

  return (
    <form
      action={formAction}
      onReset={(event) => event.preventDefault()}
      className="j-card-paper space-y-7 p-5 sm:p-7"
    >
      {initialValue && (
        <>
          <input type="hidden" name="id" value={initialValue.id} />
          <input type="hidden" name="expected_version" value={initialValue.version} />
        </>
      )}

      <fieldset className="space-y-4">
        <legend className="j-folio mb-3">Identity and feature</legend>
        <div className="space-y-2">
          <Label htmlFor="background-name">Name</Label>
          <Input
            id="background-name"
            name="name"
            value={fields.name}
            onChange={(event) => setField("name", event.target.value)}
            maxLength={100}
            required
            {...errorAttributes(state, "name")}
          />
          <FieldErrors state={state} name="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="background-feature-name">Feature name</Label>
          <Input
            id="background-feature-name"
            name="feature_name"
            value={fields.featureName}
            onChange={(event) => setField("featureName", event.target.value)}
            maxLength={100}
            required
            {...errorAttributes(state, "feature_name")}
          />
          <FieldErrors state={state} name="feature_name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="background-feature-description">Feature description</Label>
          <textarea
            id="background-feature-description"
            name="feature_description"
            value={fields.featureDescription}
            onChange={(event) => setField("featureDescription", event.target.value)}
            rows={8}
            maxLength={20_000}
            required
            className={textareaClassName}
            {...errorAttributes(state, "feature_description")}
          />
          <FieldErrors state={state} name="feature_description" />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="j-folio mb-3">Proficiencies</legend>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Choose the skills this background grants. Tool and language slugs can be entered one per line.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map(([slug, label]) => (
            <label key={slug} className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="skills"
                value={slug}
                checked={fields.skills.includes(slug)}
                onChange={(event) => toggleSkill(slug, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <FieldErrors state={state} name="skills" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="background-tools">Tool proficiencies</Label>
            <textarea
              id="background-tools"
              name="tool_profs"
              value={fields.toolProfs}
              onChange={(event) => setField("toolProfs", event.target.value)}
              rows={4}
              placeholder="thieves-tools"
              className={textareaClassName}
              {...errorAttributes(state, "tool_profs")}
            />
            <FieldErrors state={state} name="tool_profs" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="background-languages">Fixed languages</Label>
            <textarea
              id="background-languages"
              name="fixed_languages"
              value={fields.fixedLanguages}
              onChange={(event) => setField("fixedLanguages", event.target.value)}
              rows={4}
              placeholder="elvish"
              className={textareaClassName}
              {...errorAttributes(state, "fixed_languages")}
            />
            <FieldErrors state={state} name="fixed_languages" />
          </div>
        </div>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="background-language-choice">Choose any languages</Label>
          <Input
            id="background-language-choice"
            name="language_choice_count"
            type="number"
            min="1"
            max="10"
            step="1"
            value={fields.languageChoiceCount}
            onChange={(event) => setField("languageChoiceCount", event.target.value)}
            placeholder="0"
            {...errorAttributes(state, "language_choice_count")}
          />
          <FieldErrors state={state} name="language_choice_count" />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="j-folio mb-3">Starting resources</legend>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="background-gold">Starting gold</Label>
          <Input
            id="background-gold"
            name="gold"
            type="number"
            min="0"
            step="1"
            value={fields.gold}
            onChange={(event) => setField("gold", event.target.value)}
            {...errorAttributes(state, "gold")}
          />
          <FieldErrors state={state} name="gold" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="background-equipment">Equipment description</Label>
          <textarea
            id="background-equipment"
            name="equipment"
            value={fields.equipment}
            onChange={(event) => setField("equipment", event.target.value)}
            rows={4}
            maxLength={10_000}
            className={textareaClassName}
            {...errorAttributes(state, "equipment")}
          />
          <FieldErrors state={state} name="equipment" />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="j-folio mb-3">Story prompts</legend>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Enter one option per line. For ideals, add an optional alignment after a vertical bar,
          such as <span className="font-medium text-foreground">Tradition matters | Lawful</span>.
        </p>
        {([
          ["personalityTraits", "personality_traits", "Personality traits"],
          ["ideals", "ideals", "Ideals"],
          ["bonds", "bonds", "Bonds"],
          ["flaws", "flaws", "Flaws"],
        ] as const).map(([field, name, label]) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={`background-${name}`}>{label}</Label>
            <textarea
              id={`background-${name}`}
              name={name}
              value={fields[field]}
              onChange={(event) => setField(field, event.target.value)}
              rows={4}
              className={textareaClassName}
              {...errorAttributes(state, name)}
            />
            <FieldErrors state={state} name={name} />
          </div>
        ))}
      </fieldset>

      <div className="space-y-3 border-t border-border pt-5">
        {mode === "edit" && (
          <p className="text-sm text-muted-foreground">
            Changes create a new immutable version. Existing character pins stay unchanged.
          </p>
        )}
        {state.status !== "idle" && state.message && (
          <p role="alert" className="text-sm text-destructive">{state.message}</p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/library" className={buttonVariants({ variant: "outline" })}>Cancel</Link>
          {state.status === "conflict" && (
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Reload latest
            </Button>
          )}
          <Button type="submit" variant="gold" disabled={pending || state.status === "conflict"}>
            {pending
              ? "Saving..."
              : mode === "create"
                ? "Create private background"
                : "Save new version"}
          </Button>
        </div>
      </div>
    </form>
  );
}
