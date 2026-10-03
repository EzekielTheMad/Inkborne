import { closeSync, fsyncSync, openSync, writeFileSync } from "node:fs";
import { type SupabaseClient } from "@supabase/supabase-js";
import { type BoundedManifest } from "./manifest";
export const CHARACTER_CHILD_TABLES = ["character_content_refs", "character_dm_notes", "character_feature_grants", "character_inventory", "character_rolls", "character_spell_grants", "character_spells", "character_timeline_events", "npcs"] as const;
export function childRowIdColumn(table: (typeof CHARACTER_CHILD_TABLES)[number]) { return table === "character_dm_notes" ? "character_id" : "id"; }
/** Audit only IDs below recorded run-owned parents. Never inventory preexisting characters. */
export async function captureOwnedRows(manifest: BoundedManifest, admin: SupabaseClient, file: string) {
    const rows: Array<{
        table: string;
        characterId: string;
        ids: string[];
    }> = [];
    for (const attempt of manifest.attempts.filter(a => a.characterId && !a.cleaned)) {
        const characterId = attempt.characterId!;
        const parent = await admin.from("characters").select("id,user_id,name").eq("id", characterId).single();
        if (parent.error || parent.data.user_id !== attempt.ownerId || parent.data.name !== attempt.name)
            throw new Error("Exact-ID audit parent identity check failed");
        for (const table of CHARACTER_CHILD_TABLES) {
            const column = childRowIdColumn(table);
            const result = await admin.from(table).select(column).eq("character_id", characterId);
            if (result.error)
                throw new Error(`Exact-ID child audit failed for ${table} (${result.error.code ?? "unknown"})`);
            rows.push({ table, characterId, ids: result.data.map(row => "character_id" in row ? row.character_id : row.id).sort() });
        }
    }
    const fd = openSync(file, "w");
    try {
        writeFileSync(fd, JSON.stringify({ runId: manifest.runId, capturedAt: new Date().toISOString(), rows }, null, 2));
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
}
