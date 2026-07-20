"use client";

import { useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/react";
import { Clock3, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createTimelineEvent,
  deleteTimelineEvent,
  updateTimelineEvent,
} from "@/app/(app)/characters/[id]/story-actions";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { RichTextRenderer } from "@/components/editor/rich-text-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CharacterStoryVisibility,
  CharacterTimelineEvent,
} from "@/lib/types/narrative";

interface TimelineSectionProps {
  characterId: string;
  campaignId?: string | null;
  events: CharacterTimelineEvent[];
  isOwner: boolean;
}

export function TimelineSection({
  characterId,
  campaignId,
  events,
  isOwner,
}: TimelineSectionProps) {
  const [editor, setEditor] = useState<CharacterTimelineEvent | "new" | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = (event: CharacterTimelineEvent) => {
    if (!window.confirm(`Remove “${event.title}” from the timeline?`)) return;
    startDelete(async () => {
      const result = await deleteTimelineEvent(characterId, event.id);
      setDeleteError("error" in result ? result.error : null);
    });
  };

  return (
    <section className="j-card-paper p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="j-display flex items-center gap-2 text-xl text-foreground">
            <Clock3 className="size-4 text-accent" /> Timeline
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The moments that shaped this character.
          </p>
        </div>
        {isOwner && editor === null && (
          <Button variant="outline" size="sm" onClick={() => setEditor("new")}>
            <Plus /> Add event
          </Button>
        )}
      </div>

      {editor === "new" && (
        <TimelineEditor
          characterId={characterId}
          campaignId={campaignId}
          sortOrder={events.length}
          onClose={() => setEditor(null)}
        />
      )}

      <div className="mt-5 space-y-4">
        {events.map((event) =>
          editor !== "new" && editor?.id === event.id ? (
            <TimelineEditor
              key={event.id}
              characterId={characterId}
              campaignId={campaignId}
              event={event}
              sortOrder={event.sort_order}
              onClose={() => setEditor(null)}
            />
          ) : (
            <article key={event.id} className="relative border-l border-accent/40 pl-5">
              <span className="absolute -left-1 top-2 size-2 rounded-full bg-accent" />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  {event.date_label && (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                      {event.date_label}
                    </p>
                  )}
                  <h3 className="mt-0.5 font-semibold text-foreground">{event.title}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <VisibilityBadge visibility={event.visibility} />
                  {isOwner && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Edit ${event.title}`}
                        onClick={() => setEditor(event)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete ${event.title}`}
                        disabled={isDeleting}
                        onClick={() => remove(event)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2">
                <RichTextRenderer
                  content={event.description}
                  campaignId={campaignId ?? undefined}
                />
              </div>
            </article>
          ),
        )}
        {events.length === 0 && editor !== "new" && (
          <p className="py-4 text-sm italic text-muted-foreground">
            {isOwner ? "Add the first turning point in their story." : "No timeline events shared yet."}
          </p>
        )}
      </div>
      {deleteError && <p className="mt-3 text-sm text-destructive">{deleteError}</p>}
    </section>
  );
}

interface TimelineEditorProps {
  characterId: string;
  campaignId?: string | null;
  event?: CharacterTimelineEvent;
  sortOrder: number;
  onClose: () => void;
}

function TimelineEditor({
  characterId,
  campaignId,
  event,
  sortOrder,
  onClose,
}: TimelineEditorProps) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [dateLabel, setDateLabel] = useState(event?.date_label ?? "");
  const [description, setDescription] = useState<JSONContent | null>(event?.description ?? null);
  const [visibility, setVisibility] = useState<CharacterStoryVisibility>(
    event?.visibility ?? "campaign",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const input = {
        title,
        dateLabel: dateLabel || null,
        description,
        visibility,
        sortOrder,
      };
      const result = event
        ? await updateTimelineEvent(characterId, event.id, input)
        : await createTimelineEvent(characterId, input);
      if ("error" in result) setError(result.error);
      else onClose();
    });
  };

  return (
    <div className="mt-5 space-y-3 rounded-lg border border-border bg-background/40 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Event title
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          When
          <Input
            value={dateLabel}
            maxLength={80}
            placeholder="Year 127, early spring…"
            onChange={(e) => setDateLabel(e.target.value)}
          />
        </label>
      </div>
      <RichTextEditor
        content={description}
        campaignId={campaignId ?? undefined}
        minHeight="100px"
        placeholder="What happened, and why did it matter?"
        onChange={setDescription}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <VisibilitySelect value={visibility} onChange={setVisibility} />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={isPending || title.trim().length === 0} onClick={save}>
            {isPending && <Loader2 className="animate-spin" />}
            {event ? "Save event" : "Add event"}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function VisibilityBadge({ visibility }: { visibility: CharacterStoryVisibility }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
      {visibility === "campaign" ? "Campaign" : "DM & me"}
    </span>
  );
}

function VisibilitySelect({
  value,
  onChange,
}: {
  value: CharacterStoryVisibility;
  onChange: (value: CharacterStoryVisibility) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      Visible to
      <select
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value as CharacterStoryVisibility)}
      >
        <option value="campaign">Campaign</option>
        <option value="dm_only">DM & me</option>
      </select>
    </label>
  );
}
