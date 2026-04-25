"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  active_characters: number;
  archived_characters: number;
}

type SortKey = "last_sign_in" | "signed_up" | "name" | "characters";
type SortDir = "asc" | "desc";

interface UsersAdminClientProps {
  rows: UserRow[];
}

export function UsersAdminClient({ rows }: UsersAdminClientProps) {
  const [sortKey, setSortKey] = useState<SortKey>("last_sign_in");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "last_sign_in": {
          const aT = a.last_sign_in_at ? Date.parse(a.last_sign_in_at) : 0;
          const bT = b.last_sign_in_at ? Date.parse(b.last_sign_in_at) : 0;
          cmp = aT - bT;
          break;
        }
        case "signed_up": {
          cmp = Date.parse(a.signed_up_at) - Date.parse(b.signed_up_at);
          break;
        }
        case "name": {
          const aN = (a.display_name || a.email).toLowerCase();
          const bN = (b.display_name || b.email).toLowerCase();
          cmp = aN.localeCompare(bN);
          break;
        }
        case "characters": {
          cmp = a.active_characters - b.active_characters;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default direction depends on column type — recency cols default to desc, name to asc.
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} signed-up {rows.length === 1 ? "user" : "users"}. Sort by clicking
          column headers.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No users yet.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <SortHeader
                  label="User"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => setSort("name")}
                />
                <SortHeader
                  label="Last sign-in"
                  active={sortKey === "last_sign_in"}
                  dir={sortDir}
                  onClick={() => setSort("last_sign_in")}
                />
                <SortHeader
                  label="Signed up"
                  active={sortKey === "signed_up"}
                  dir={sortDir}
                  onClick={() => setSort("signed_up")}
                />
                <SortHeader
                  label="Characters"
                  active={sortKey === "characters"}
                  dir={sortDir}
                  onClick={() => setSort("characters")}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium">
                      {row.display_name || (
                        <span className="text-muted-foreground italic">No name</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">
                      {row.email}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {formatDateTime(row.last_sign_in_at)}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {formatDate(row.signed_up_at)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className="font-medium">{row.active_characters}</span>
                    {row.archived_characters > 0 && (
                      <span className="text-muted-foreground text-xs ml-2">
                        +{row.archived_characters} archived
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-3 py-2 font-medium",
        align === "right" && "text-right",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active && "text-foreground",
        )}
      >
        {label}
        {active && <span aria-hidden="true">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
