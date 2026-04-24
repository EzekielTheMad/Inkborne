"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ErrorRow, ErrorStatus, ErrorSource } from "@/lib/supabase/errors";
import { updateErrorAction } from "./actions";

const STATUS_OPTIONS: ErrorStatus[] = ["new", "triaged", "resolved", "wontfix", "duplicate"];

const STATUS_STYLES: Record<ErrorStatus, string> = {
  new: "bg-destructive/20 text-destructive border-destructive/40",
  triaged: "bg-accent/20 text-accent border-accent/40",
  resolved: "bg-green-500/20 text-green-500 border-green-500/40",
  wontfix: "bg-muted text-muted-foreground border-border",
  duplicate: "bg-muted text-muted-foreground border-border",
};

const SOURCE_LABEL: Record<ErrorSource, string> = {
  client_unhandled: "Client (uncaught)",
  client_rejection: "Client (promise)",
  client_boundary: "Client (React)",
  server_action: "Server action",
  server_route: "Server route",
  manual: "Manual",
};

interface ErrorAdminClientProps {
  rows: ErrorRow[];
}

export function ErrorAdminClient({ rows }: ErrorAdminClientProps) {
  const [filter, setFilter] = useState<ErrorStatus | "all">("all");

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Errors</h1>
        <p className="text-sm text-muted-foreground">
          Captured from client listeners, React boundary, and server-side reporters.{" "}
          {rows.length} total (showing most recent 500).
        </p>
      </div>

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
        <p className="text-sm text-muted-foreground italic">No errors match this filter.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <ErrorCard key={row.id} row={row} />
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

function ErrorCard({ row }: { row: ErrorRow }) {
  const [status, setStatus] = useState<ErrorStatus>(row.status);
  const [notes, setNotes] = useState<string>(row.admin_notes ?? "");
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const dirty = status !== row.status || (notes || "") !== (row.admin_notes ?? "");

  const handleSave = () => {
    setSaveMsg(null);
    startTransition(async () => {
      const result = await updateErrorAction(row.id, {
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
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{SOURCE_LABEL[row.source]}</Badge>
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
        {row.user_id && (
          <span
            className="text-xs text-muted-foreground ml-auto truncate max-w-[180px]"
            title={row.user_id}
          >
            {row.user_id.slice(0, 8)}…
          </span>
        )}
        {!row.user_id && (
          <span className="text-xs text-muted-foreground ml-auto italic">anonymous</span>
        )}
      </div>

      <p className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
        {row.message}
      </p>

      {(row.stack || row.context) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      )}

      {expanded && (
        <div className="space-y-2 border-t border-border/50 pt-2">
          {row.stack && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Stack</p>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/50 p-2 rounded max-h-64 overflow-y-auto">
                {row.stack}
              </pre>
            </div>
          )}
          {row.context && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Context</p>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/50 p-2 rounded max-h-48 overflow-y-auto">
                {JSON.stringify(row.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

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

      <div className="grid md:grid-cols-[200px_1fr] gap-2 items-start pt-2 border-t border-border/50">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ErrorStatus)}
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
