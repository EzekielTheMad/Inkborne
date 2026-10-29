"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/react";
import { Clock3, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createTimelineEvent,
  deleteTimelineEvent,
  readTimelineEvent,
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

export function TimelineSection(props: TimelineSectionProps) {
  // Never carry an open editor across a character or owner/viewer boundary.
  return <JournalTimeline key={`${props.characterId}:${props.isOwner}`} {...props} />;
}

function JournalTimeline({
  characterId,
  campaignId,
  events,
  isOwner,
}: TimelineSectionProps) {
  const [editor, setEditor] = useState<CharacterTimelineEvent | "new" | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [order, setOrder] = useState("newest");
  const orderedEvents = [...events].sort((a, b) => {
    if (order === "timeline" && a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const chronological = a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
    return order === "newest" ? -chronological : chronological;
  });
  const nextSortOrder = events.reduce((max, event) => Math.max(max, event.sort_order), -1) + 1;

  const remove = (event: CharacterTimelineEvent) => {
    if (!window.confirm(`Remove “${event.title}” from the journal and timeline?`)) return;
    startDelete(async () => {
      try {
        const result = await deleteTimelineEvent(characterId, event.id);
        setDeleteError("error" in result ? result.error : null);
      } catch {
        setDeleteError("Removal could not be confirmed. Reopen the journal to check before trying again.");
      }
    });
  };

  return (
    <section className="j-card-paper p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="j-display flex items-center gap-2 text-xl text-foreground">
            <Clock3 className="size-4 text-accent" /> Journal & timeline
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Backstory tells where they came from. Keep ongoing experiences and reflections here;
            the timeline puts those entries in story order.
          </p>
        </div>
        {isOwner && editor === null && (
          <Button variant="outline" size="sm" disabled={isDeleting} onClick={() => setEditor("new")}>
            <Plus /> Write entry
          </Button>
        )}
      </div>
      <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        Browse entries
        <select className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          value={order} onChange={(event) => setOrder(event.target.value)}>
          <option value="newest">Newest written first</option>
          <option value="oldest">Oldest written first</option>
          <option value="timeline">Timeline order</option>
        </select>
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        {campaignId
          ? "DM & me includes the character owner and campaign DM. Campaign also includes campaign members."
          : "Only you can read entries while this character has no campaign. Choose who may read them if you join one later."}
      </p>

      {editor !== null && (
        <TimelineEditor
          key={editor === "new" ? "new" : editor.id}
          characterId={characterId}
          campaignId={campaignId}
          event={editor === "new" ? undefined : editor}
          sortOrder={editor === "new" ? nextSortOrder : editor.sort_order}
          onClose={() => setEditor(null)}
        />
      )}

      <div className="mt-5 space-y-4">
        {orderedEvents.filter(event => editor === "new" || editor?.id !== event.id).map((event) => (
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
                  <VisibilityBadge visibility={event.visibility} campaignId={campaignId} isOwner={isOwner} />
                  {isOwner && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Edit ${event.title}`}
                        disabled={editor !== null || isDeleting}
                        onClick={() => setEditor(event)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete ${event.title}`}
                        disabled={editor !== null || isDeleting}
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
          ))}
        {events.length === 0 && editor !== "new" && (
          <p className="py-4 text-sm italic text-muted-foreground">
            {isOwner ? "Write a memory, discovery, or reflection. No campaign needed." : "No journal entries shared yet."}
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
    event?.visibility ?? "dm_only",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [failure, setFailure] = useState<"unknown" | "conflict" | "reopen" | null>(null);
  const [savedEntry, setSavedEntry] = useState<CharacterTimelineEvent | null>(null);
  const [isChecking, startCheck] = useTransition();
  const attemptId = useRef<string | null>(null);
  const saving = useRef(false);
  const busy = isPending || isChecking;
  const dirty = title !== (event?.title ?? "") || dateLabel !== (event?.date_label ?? "") ||
    JSON.stringify(description) !== JSON.stringify(event?.description ?? null) ||
    visibility !== (event?.visibility ?? "dm_only");

  useEffect(() => {
    if (!dirty && !busy && !failure) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy, failure]);

  const cancel = () => {
    if ((dirty || failure) && !window.confirm("Discard this journal draft? It has not been confirmed saved.")) return;
    onClose();
  };

  const downloadDraft = () => {
    const draft = JSON.stringify({ characterId, entryId: event?.id ?? attemptId.current,
      expectedUpdatedAt: event?.updated_at ?? null, title, dateLabel, description, visibility }, null, 2);
    const url = URL.createObjectURL(new Blob([draft], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "journal-draft.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const unconfirmed = () => {
    setFailure("unknown");
    setSavedEntry(null);
    setError("Save status unknown. Your draft is still here. Check the saved entry by its exact ID. Saving again is paused to avoid duplicate entries.");
  };

  const save = () => {
    if (saving.current || failure) return;
    saving.current = true;
    setError(null);
    startTransition(async () => {
      try {
        // One UUID for this mounted create attempt, including verified-absent
        // retries. A late committed INSERT can only conflict with the same PK.
        if (!event) attemptId.current ??= crypto.randomUUID();
        const identity = event?.id ?? attemptId.current!;
        const input = {
          title, dateLabel: dateLabel || null, description, visibility, sortOrder,
          ...(event ? { expectedUpdatedAt: event.updated_at } : { entryId: identity }),
        };
        const result = event
          ? await updateTimelineEvent(characterId, event.id, input)
          : await createTimelineEvent(characterId, input);
        if (result?.status === "saved" && Object.keys(result).length === 3 && result.entryId === identity && Number.isFinite(Date.parse(result.updatedAt))) onClose();
        else if (result?.status === "rejected" && ["invalid", "not_authorized", "reopen_required"].includes(result.code) && typeof result.error === "string") {
          setFailure(result.code === "reopen_required" ? "reopen" : null);
          setError(`${result.error}. Your draft is still here.`);
        } else if (result?.status === "conflict" && typeof result.error === "string") {
          setFailure("conflict"); setError(result.error);
        } else unconfirmed();
      } catch {
        // The server may have committed before the connection failed. Never replay blindly.
        unconfirmed();
      } finally {
        saving.current = false;
      }
    });
  };

  const checkSaved = () => {
    const identity = event?.id ?? attemptId.current;
    if (!identity || saving.current) return;
    saving.current = true;
    startCheck(async () => {
      try {
        const result = await readTimelineEvent(characterId, identity);
        if (result?.status === "found" && result.entry?.id === identity && result.entry.character_id === characterId) {
          setSavedEntry(result.entry);
          setError("Saved entry found for this exact ID. Your draft is still here. Close the draft and reopen the entry to use its latest saved version.");
        } else if (result?.status === "absent" && Object.keys(result).length === 1) {
          setSavedEntry(null);
          if (event) {
            setFailure("conflict"); setError("This entry is no longer available. Your draft is still here.");
          } else {
            setFailure(null);
            setError("No saved entry was found for this attempt. You can explicitly save again using the same entry ID. Your draft is still here.");
          }
        } else if (result?.status === "rejected" && typeof result.error === "string") {
          setError(`${result.error}. Your draft is still here; saving remains paused.`);
        } else unconfirmed();
      } catch { unconfirmed(); }
      finally { saving.current = false; }
    });
  };

  return (
    <div role="group" aria-label={event ? `Edit ${event.title}` : "New journal entry"} className="mt-5 space-y-3 rounded-lg border border-border bg-background/40 p-4">
      <fieldset disabled={busy} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Entry title
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
        editable={!busy}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <VisibilitySelect value={visibility} campaignId={campaignId} onChange={setVisibility} />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={cancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={busy || failure !== null || title.trim().length === 0} onClick={save}>
            {isPending && <Loader2 className="animate-spin" />}
            {isPending ? "Saving…" : "Save entry"}
          </Button>
        </div>
      </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {error && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={downloadDraft}>Download draft</Button>
        {failure && (event?.id || attemptId.current) &&
          <Button variant="outline" size="sm" disabled={busy} onClick={checkSaved}>{isChecking ? "Checking…" : "Check saved entry"}</Button>}
      </div>}
      {savedEntry && <aside className="rounded-lg border border-border p-3" aria-label="Saved entry readback">
        <h4 className="font-semibold">Saved entry: {savedEntry.title}</h4>
        <p className="text-xs text-muted-foreground">{savedEntry.date_label}</p>
        <VisibilityBadge visibility={savedEntry.visibility} campaignId={campaignId} />
        <RichTextRenderer content={savedEntry.description} campaignId={campaignId ?? undefined} />
      </aside>}
    </div>
  );
}

export function VisibilityBadge({ visibility, campaignId, isOwner = true }: {
  visibility: CharacterStoryVisibility;
  campaignId?: string | null;
  isOwner?: boolean;
}) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
      {campaignId
        ? visibility === "campaign" ? "Campaign" : isOwner ? "DM & me" : "Owner & DM"
        : visibility === "campaign" ? "Only you · Campaign if assigned" : "Only you · DM & me if assigned"}
    </span>
  );
}

function VisibilitySelect({
  value,
  campaignId,
  onChange,
}: {
  value: CharacterStoryVisibility;
  campaignId?: string | null;
  onChange: (value: CharacterStoryVisibility) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {campaignId ? "Audience" : "Audience if assigned to a campaign"}
      <select
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value as CharacterStoryVisibility)}
      >
        <option value="dm_only">DM & me</option>
        <option value="campaign">Campaign</option>
      </select>
    </label>
  );
}
