"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FeedbackRow, FeedbackStatus } from "@/lib/supabase/feedback";
import { updateFeedbackAction } from "./actions";

const STATUS_OPTIONS: FeedbackStatus[] = ["new", "triaged", "resolved", "wontfix"];

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  new: "bg-primary/20 text-primary border-primary/40",
  triaged: "bg-accent/20 text-accent border-accent/40",
  resolved: "bg-green-500/20 text-green-500 border-green-500/40",
  wontfix: "bg-muted text-muted-foreground border-border",
};

interface FeedbackAdminClientProps {
  rows: FeedbackRow[];
}

export function FeedbackAdminClient({ rows }: FeedbackAdminClientProps) {
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="text-sm text-muted-foreground">
          Alpha feedback submissions. {rows.length} total.
        </p>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={`All (${rows.length})`}
        />
        {STATUS_OPTIONS.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={`${s} (${counts[s] ?? 0})`}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No feedback matches this filter.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <FeedbackCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs px-3 py-1 rounded-full border capitalize transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-muted-foreground border-border hover:border-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function FeedbackCard({ row }: { row: FeedbackRow }) {
  const [status, setStatus] = useState<FeedbackStatus>(row.status);
  const [notes, setNotes] = useState<string>(row.admin_notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const dirty =
    status !== row.status || (notes || "") !== (row.admin_notes ?? "");

  const handleSave = () => {
    setSaveMsg(null);
    startTransition(async () => {
      const result = await updateFeedbackAction(row.id, {
        status,
        admin_notes: notes.trim() || null,
      });
      if (result.error) {
        setSaveMsg(`Error: ${result.error}`);
      } else {
        setSaveMsg("Saved.");
        setTimeout(() => setSaveMsg(null), 2000);
      }
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        {row.tag && (
          <Badge variant="outline" className="capitalize">
            {row.tag}
          </Badge>
        )}
        <span
          className={cn(
            "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border",
            STATUS_STYLES[row.status],
          )}
        >
          {row.status}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground ml-auto truncate max-w-[180px]" title={row.user_id}>
          {row.user_id.slice(0, 8)}…
        </span>
      </div>

      {/* Feedback text */}
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{row.text}</p>

      {/* Meta */}
      <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border/50 pt-2">
        {row.page_url && (
          <p>
            <span className="font-medium">Page:</span> {row.page_url}
          </p>
        )}
        {row.user_agent && (
          <p className="truncate" title={row.user_agent}>
            <span className="font-medium">UA:</span> {row.user_agent}
          </p>
        )}
      </div>

      {/* Admin controls */}
      <div className="grid md:grid-cols-[200px_1fr] gap-2 items-start pt-2 border-t border-border/50">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
          className="text-sm rounded-md border border-input bg-background px-2 py-1.5 w-full"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Admin notes (optional)..."
          rows={2}
          className="text-sm rounded-md border border-input bg-background px-2 py-1.5 resize-none w-full"
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={!dirty || isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        {saveMsg && (
          <span
            className={cn(
              "text-xs",
              saveMsg.startsWith("Error") ? "text-destructive" : "text-primary",
            )}
          >
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  );
}
