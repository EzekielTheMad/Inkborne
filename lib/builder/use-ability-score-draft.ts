"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AbilityScoreConflictError,
  saveCharacterAbilities,
  type AbilityScoreDraft,
  type AbilityScoreSnapshot,
} from "@/lib/supabase/ability-scores-client";

type SaveStatus = "saved" | "saving" | "error" | "conflict" | "session_changed";
interface EditorSnapshot { draft: AbilityScoreDraft; status: SaveStatus }

// Browser-memory recovery only: do not put character data in persistent storage.
// Unsaved entries survive SPA navigation; successful unused entries are released.
const drafts = new Map<string, ReturnType<typeof createDraftStore>>();
const MAX_INACTIVE_DRAFTS = 20;
let currentOwner: string | null = null;
let unsubscribeAuth: (() => void) | null = null;
let unloadWarningInstalled = false;

function warnBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}

function syncUnloadWarning() {
  if (typeof window === "undefined") return;
  const hasUnsaved = [...drafts.values()].some((store) =>
    ["saving", "error", "conflict"].includes(store.getSnapshot().status),
  );
  if (hasUnsaved && !unloadWarningInstalled) {
    window.addEventListener("beforeunload", warnBeforeUnload);
  } else if (!hasUnsaved && unloadWarningInstalled) {
    window.removeEventListener("beforeunload", warnBeforeUnload);
  }
  unloadWarningInstalled = hasUnsaved;
}

function draftKey(ownerId: string, characterId: string) {
  return `${ownerId}:${characterId}`;
}

function clearDraftsOutsideOwner(ownerId: string | null) {
  for (const [key, store] of drafts) {
    if (store.ownerId !== ownerId) {
      store.discard();
      drafts.delete(key);
    }
  }
  releaseUnusedRecovery();
}

function watchRecoverySession(ownerId: string) {
  clearDraftsOutsideOwner(ownerId);
  currentOwner = ownerId;
  if (unsubscribeAuth) return;
  const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      clearDraftsOutsideOwner(null);
      currentOwner = null;
    } else if (session?.user.id && session.user.id !== currentOwner) {
      clearDraftsOutsideOwner(session.user.id);
      currentOwner = session.user.id;
    }
  });
  unsubscribeAuth = () => subscription.unsubscribe();
}

function releaseUnusedRecovery() {
  const inactive = [...drafts.entries()].filter(([, store]) => !store.isActive());
  for (const [key, store] of inactive.slice(0, Math.max(0, inactive.length - MAX_INACTIVE_DRAFTS))) {
    store.discard();
    drafts.delete(key);
  }
  if (!drafts.size) {
    unsubscribeAuth?.();
    unsubscribeAuth = null;
    currentOwner = null;
  }
  syncUnloadWarning();
}

/** Used only when explicitly abandoning a conflicted draft to reload the server. */
export function discardAbilityScoreDraft(ownerId: string, characterId: string) {
  const key = draftKey(ownerId, characterId);
  drafts.get(key)?.discard();
  drafts.delete(key);
  releaseUnusedRecovery();
}

function createDraftStore(
  ownerId: string,
  characterId: string,
  initialDraft: AbilityScoreDraft,
  persistedSnapshot: AbilityScoreSnapshot,
) {
  let snapshot: EditorSnapshot = { draft: initialDraft, status: "saved" };
  let saved = persistedSnapshot;
  let sequence = 0;
  let queue = Promise.resolve();
  let conflicted = false;
  let discarded = false;
  const listeners = new Set<() => void>();
  const key = draftKey(ownerId, characterId);

  function releaseWhenSaved() {
    queueMicrotask(() => {
      if (!listeners.size && snapshot.status === "saved" && drafts.get(key) === store) {
        drafts.delete(key);
      }
      releaseUnusedRecovery();
    });
  }

  function publish(next: EditorSnapshot) {
    snapshot = next;
    syncUnloadWarning();
    for (const listener of listeners) listener();
    releaseWhenSaved();
  }

  function enqueue(next: AbilityScoreDraft) {
    const revision = ++sequence;
    publish({ draft: next, status: "saving" });
    queue = queue.then(async () => {
      if (conflicted || discarded) return;
      try {
        // Raw expectations advance only on a successful canonical response.
        // CAS rejects stale full-page/tab editors; SPA remounts share this queue.
        const result = await saveCharacterAbilities(characterId, next, saved);
        if (discarded) return;
        saved = result;
        if (sequence === revision) publish({ draft: snapshot.draft, status: "saved" });
      } catch (error) {
        if (discarded) return;
        if (error instanceof AbilityScoreConflictError) {
          conflicted = true;
          publish({ draft: snapshot.draft, status: "conflict" });
        } else if (sequence === revision) {
          publish({ draft: snapshot.draft, status: "error" });
        }
      }
    });
  }

  const store = {
    ownerId,
    isActive: () => listeners.size > 0,
    discard() {
      discarded = true;
      saved = { method: null, scores: {} };
      publish({ draft: { method: "standard_array", scores: {} }, status: "session_changed" });
    },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); releaseWhenSaved(); };
    },
    changeDraft(change: (previous: AbilityScoreDraft) => AbilityScoreDraft) {
      if (conflicted || discarded) return;
      const next = change(snapshot.draft);
      if (next !== snapshot.draft) enqueue(next);
    },
    retry() {
      if (snapshot.status === "error") enqueue(snapshot.draft);
    },
  };
  return store;
}

/** Keep accepted drafts ordered and recover failed saves after an in-app exit. */
export function useAbilityScoreDraft(
  ownerId: string,
  characterId: string,
  initialDraft: AbilityScoreDraft,
  persistedSnapshot: AbilityScoreSnapshot,
) {
  const [serverSnapshot] = useState<EditorSnapshot>(() => ({ draft: initialDraft, status: "saved" }));
  const [store] = useState(() => {
    // Never share draft data between server requests/users during SSR.
    if (typeof window === "undefined") return createDraftStore(ownerId, characterId, initialDraft, persistedSnapshot);
    const key = draftKey(ownerId, characterId);
    const existing = drafts.get(key);
    if (existing) {
      // Revisited drafts become the newest entry for bounded recovery eviction.
      drafts.delete(key);
      drafts.set(key, existing);
      return existing;
    }
    const created = createDraftStore(ownerId, characterId, initialDraft, persistedSnapshot);
    drafts.set(key, created);
    return created;
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverSnapshot);

  useEffect(() => { watchRecoverySession(ownerId); }, [ownerId]);

  return { ...snapshot, changeDraft: store.changeDraft, retry: store.retry };
}
