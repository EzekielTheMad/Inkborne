"use client";

import { useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/react";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  createRelationship,
  deleteRelationship,
  updateRelationship,
} from "@/app/(app)/characters/[id]/story-actions";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { RichTextRenderer } from "@/components/editor/rich-text-renderer";
import { VisibilityBadge } from "@/components/narrative/timeline-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CharacterRelationship,
  CharacterStoryVisibility,
} from "@/lib/types/narrative";

interface RelationshipsSectionProps {
  characterId: string;
  campaignId?: string | null;
  relationships: CharacterRelationship[];
  isOwner: boolean;
}

export function RelationshipsSection({
  characterId,
  campaignId,
  relationships,
  isOwner,
}: RelationshipsSectionProps) {
  const [editor, setEditor] = useState<CharacterRelationship | "new" | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = (relationship: CharacterRelationship) => {
    if (!window.confirm(`Remove ${relationship.name} from this character’s relationships?`)) return;
    startDelete(async () => {
      const result = await deleteRelationship(characterId, relationship.id);
      setDeleteError("error" in result ? result.error : null);
    });
  };

  return (
    <section className="j-card-paper p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="j-display flex items-center gap-2 text-xl text-foreground">
            <Users className="size-4 text-accent" /> Relationships
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Allies, rivals, family, and everyone between.
          </p>
        </div>
        {isOwner && editor === null && (
          <Button variant="outline" size="sm" onClick={() => setEditor("new")}>
            <Plus /> Add person
          </Button>
        )}
      </div>

      {editor === "new" && (
        <RelationshipEditor
          characterId={characterId}
          campaignId={campaignId}
          onClose={() => setEditor(null)}
        />
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {relationships.map((relationship) =>
          editor !== "new" && editor?.id === relationship.id ? (
            <div key={relationship.id} className="sm:col-span-2">
              <RelationshipEditor
                characterId={characterId}
                campaignId={campaignId}
                relationship={relationship}
                onClose={() => setEditor(null)}
              />
            </div>
          ) : (
            <article key={relationship.id} className="rounded-lg border border-border bg-background/30 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">{relationship.name}</h3>
                  {relationship.relationship && (
                    <p className="text-xs text-accent">{relationship.relationship}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <VisibilityBadge visibility={relationship.visibility} />
                  {isOwner && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Edit ${relationship.name}`}
                        onClick={() => setEditor(relationship)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete ${relationship.name}`}
                        disabled={isDeleting}
                        onClick={() => remove(relationship)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <RichTextRenderer
                  content={relationship.description}
                  campaignId={campaignId ?? undefined}
                />
              </div>
            </article>
          ),
        )}
        {relationships.length === 0 && editor !== "new" && (
          <p className="py-4 text-sm italic text-muted-foreground sm:col-span-2">
            {isOwner ? "Add someone who matters to this character." : "No relationships shared yet."}
          </p>
        )}
      </div>
      {deleteError && <p className="mt-3 text-sm text-destructive">{deleteError}</p>}
    </section>
  );
}

interface RelationshipEditorProps {
  characterId: string;
  campaignId?: string | null;
  relationship?: CharacterRelationship;
  onClose: () => void;
}

function RelationshipEditor({
  characterId,
  campaignId,
  relationship,
  onClose,
}: RelationshipEditorProps) {
  const [name, setName] = useState(relationship?.name ?? "");
  const [role, setRole] = useState(relationship?.relationship ?? "");
  const [description, setDescription] = useState<JSONContent | null>(
    relationship?.description ?? null,
  );
  const [visibility, setVisibility] = useState<CharacterStoryVisibility>(
    relationship?.visibility ?? "campaign",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const input = {
        name,
        relationship: role || null,
        description,
        visibility,
      };
      const result = relationship
        ? await updateRelationship(characterId, relationship.id, input)
        : await createRelationship(characterId, input);
      if ("error" in result) setError(result.error);
      else onClose();
    });
  };

  return (
    <div className="mt-5 space-y-3 rounded-lg border border-border bg-background/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Name
          <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Relationship
          <Input
            value={role}
            maxLength={120}
            placeholder="Mentor, rival, sibling…"
            onChange={(e) => setRole(e.target.value)}
          />
        </label>
      </div>
      <RichTextEditor
        content={description}
        campaignId={campaignId ?? undefined}
        minHeight="100px"
        placeholder="How do they know each other? What remains unresolved?"
        onChange={setDescription}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Visible to
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as CharacterStoryVisibility)}
          >
            <option value="campaign">Campaign</option>
            <option value="dm_only">DM & me</option>
          </select>
        </label>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={isPending || name.trim().length === 0} onClick={save}>
            {isPending && <Loader2 className="animate-spin" />}
            {relationship ? "Save person" : "Add person"}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
