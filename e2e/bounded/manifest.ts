import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { z } from "zod";
export const APPROVED_PROJECT = "etcaodglvcspcmwecyxq";
export const CHARACTER_LIMIT = 6;
const uuid = z.string().uuid();
const header = z.object({ kind: z.literal("run"), project: z.literal(APPROVED_PROJECT), runId: uuid }).strict();
const reservation = z.object({ kind: z.literal("reserve"), attemptId: uuid, ownerId: uuid, name: z.string().min(1).max(100) }).strict();
const created = z.object({ kind: z.literal("created"), attemptId: uuid, characterId: uuid }).strict();
const cleaned = z.object({ kind: z.literal("cleaned"), characterId: uuid }).strict();
const event = z.discriminatedUnion("kind", [header, reservation, created, cleaned]);
type Event = z.infer<typeof event>;
export type Reservation = z.infer<typeof reservation> & {
    characterId?: string;
    cleaned?: boolean;
};
/** One process owns the journal. Every creation attempt is fsynced BEFORE click/insert.
 * Failed or ambiguous attempts still consume the six-character budget. Never sweep names.
 */
export class BoundedManifest {
    private readonly lockPath: string;
    private lock: number;
    readonly attempts: Reservation[] = [];
    readonly runId: string;
    constructor(readonly file: string, runId: string) {
        this.runId = uuid.parse(runId);
        this.lockPath = `${file}.lock`;
        this.lock = openSync(this.lockPath, "wx");
        try {
            if (existsSync(file)) {
                const content = readFileSync(file, "utf8");
                if (!content.endsWith("\n"))
                    throw new Error("Incomplete journal; reconcile manually before continuing");
                const events = content.trimEnd().split("\n").map(line => event.parse(JSON.parse(line)));
                const first = header.parse(events.shift());
                if (first.runId !== this.runId)
                    throw new Error("Run ID does not match manifest");
                for (const entry of events)
                    this.apply(entry);
            }
            else {
                const fd = openSync(file, "wx");
                closeSync(fd);
                this.append({ kind: "run", project: APPROVED_PROJECT, runId: this.runId });
            }
        }
        catch (error) {
            this.close();
            throw error;
        }
    }
    private apply(entry: Event) {
        if (entry.kind === "reserve") {
            if (this.attempts.length >= CHARACTER_LIMIT || this.attempts.some(a => a.attemptId === entry.attemptId || a.name === entry.name)) {
                throw new Error("Invalid or over-budget reservation");
            }
            if (!entry.name.startsWith(`Inkborne bounded ${this.runId} `))
                throw new Error("Reservation does not belong to this run");
            this.attempts.push({ ...entry });
        }
        else if (entry.kind === "created") {
            const attempt = this.attempts.find(a => a.attemptId === entry.attemptId);
            if (!attempt || attempt.characterId || this.attempts.some(a => a.characterId === entry.characterId))
                throw new Error("Invalid character assignment");
            attempt.characterId = entry.characterId;
        }
        else if (entry.kind === "cleaned") {
            const attempt = this.attempts.find(a => a.characterId === entry.characterId);
            if (!attempt || attempt.cleaned)
                throw new Error("Invalid cleanup receipt");
            attempt.cleaned = true;
        }
        else
            throw new Error("Unexpected journal header");
    }
    private append(entry: Event) {
        if (this.lock < 0)
            throw new Error("Manifest is closed");
        const fd = openSync(this.file, "a");
        try {
            writeFileSync(fd, `${JSON.stringify(entry)}\n`);
            fsyncSync(fd);
        }
        finally {
            closeSync(fd);
        }
    }
    reserve(ownerId: string, label: string): Reservation {
        if (this.attempts.some(a => !a.characterId && !a.cleaned))
            throw new Error("Reconcile the unresolved creation attempt first");
        if (this.attempts.length >= CHARACTER_LIMIT)
            throw new Error("Six-character creation ceiling reached");
        if (!/^[a-z0-9-]{1,24}$/.test(label))
            throw new Error("Use a short non-secret fixture label");
        const entry = reservation.parse({ kind: "reserve", attemptId: randomUUID(), ownerId, name: `Inkborne bounded ${this.runId} ${this.attempts.length + 1}-${label}` });
        this.append(entry);
        this.apply(entry);
        return { ...entry };
    }
    recordCreated(attemptId: string, characterId: string) {
        const entry = created.parse({ kind: "created", attemptId, characterId });
        const attempt = this.attempts.find(a => a.attemptId === attemptId);
        if (!attempt || attempt.characterId || this.attempts.some(a => a.characterId === characterId))
            throw new Error("Invalid character assignment");
        this.append(entry);
        this.apply(entry);
    }
    cleanupScope(confirmRunId: string) {
        if (confirmRunId !== this.runId)
            throw new Error("Cleanup requires the exact run ID");
        if (this.attempts.some(a => !a.characterId))
            throw new Error("Reconcile unresolved attempts before cleanup");
        return this.attempts.filter(a => !a.cleaned).map(a => ({ id: a.characterId!, ownerId: a.ownerId, name: a.name }));
    }
    recordCleaned(characterId: string) {
        const entry = cleaned.parse({ kind: "cleaned", characterId });
        const attempt = this.attempts.find(a => a.characterId === characterId);
        if (!attempt || attempt.cleaned)
            throw new Error("Invalid cleanup receipt");
        this.append(entry);
        this.apply(entry);
    }
    close() {
        if (this.lock >= 0) {
            closeSync(this.lock);
            this.lock = -1;
            unlinkSync(this.lockPath);
        }
    }
}
