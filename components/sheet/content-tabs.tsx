"use client";

import { useState } from "react";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { ActionsTab } from "@/components/sheet/tabs/actions-tab";
import { SpellsTab } from "@/components/sheet/tabs/spells-tab";
import { InventoryTab } from "@/components/sheet/tabs/inventory-tab";
import { FeaturesTab } from "@/components/sheet/tabs/features-tab";
import { NotesTab } from "@/components/sheet/tabs/notes-tab";

type TabId = "actions" | "spells" | "inventory" | "features" | "notes";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "actions", label: "Actions" },
  { id: "spells", label: "Spells" },
  { id: "inventory", label: "Inventory" },
  { id: "features", label: "Features" },
  { id: "notes", label: "Notes" },
];

interface ContentTabsProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  contentRefs: ContentRefWithContent[];
  state: CharacterState;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;
  initialTab?: TabId;
}

export function ContentTabs({
  character,
  schema,
  evalResult,
  contentRefs,
  state,
  patchState,
  initialTab = "actions",
}: ContentTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-border bg-background shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "actions" && (
          <ActionsTab
            character={character}
            schema={schema}
            evalResult={evalResult}
            contentRefs={contentRefs}
          />
        )}
        {activeTab === "spells" && <SpellsTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "features" && (
          <FeaturesTab
            character={character}
            schema={schema}
            contentRefs={contentRefs}
          />
        )}
        {activeTab === "notes" && <NotesTab state={state} patchState={patchState} />}
      </div>
    </div>
  );
}
