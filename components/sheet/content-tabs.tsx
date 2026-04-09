"use client";

import { useState } from "react";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { FeaturesTab } from "@/components/sheet/tabs/features-tab";
import { ActionsTab } from "@/components/sheet/tabs/actions-tab";
import { SpellsTab } from "@/components/sheet/tabs/spells-tab";
import { InventoryTab } from "@/components/sheet/tabs/inventory-tab";
import { NotesTab } from "@/components/sheet/tabs/notes-tab";

const TABS = [
  { id: "actions", label: "Actions" },
  { id: "spells", label: "Spells" },
  { id: "inventory", label: "Inventory" },
  { id: "features", label: "Features" },
  { id: "notes", label: "Notes" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ContentTabsProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  contentRefs: ContentRefWithContent[];
  state: CharacterState;
  patchState: (patch: Partial<CharacterState>) => void;
}

export function ContentTabs({
  character,
  schema,
  evalResult,
  contentRefs,
  state,
  patchState,
}: ContentTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("actions");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <nav className="flex border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium shrink-0 transition-colors ${
              activeTab === tab.id
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content — scrollable */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "actions" && (
          <ActionsTab
            character={character}
            schema={schema}
            evalResult={evalResult}
            contentRefs={contentRefs}
          />
        )}
        {activeTab === "spells" && (
          <SpellsTab contentRefs={contentRefs} />
        )}
        {activeTab === "inventory" && (
          <InventoryTab
            character={character}
            contentRefs={contentRefs}
          />
        )}
        {activeTab === "features" && (
          <FeaturesTab
            character={character}
            schema={schema}
            contentRefs={contentRefs}
          />
        )}
        {activeTab === "notes" && (
          <NotesTab state={state} patchState={patchState} />
        )}
      </div>
    </div>
  );
}
