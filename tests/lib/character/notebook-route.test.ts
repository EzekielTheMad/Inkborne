import { describe, expect, it } from "vitest";
import { isCharacterNotebookPath, isNotebookAppPath } from "@/lib/character/notebook-route";

describe("notebook route boundaries", () => {
  it.each(["/dashboard", "/dashboard/", "/characters", "/characters/", "/characters/mara", "/characters/mara/"])(
    "scopes the migrated overview/sheet route %s", (pathname) => expect(isNotebookAppPath(pathname)).toBe(true),
  );
  it.each([null, "/", "/login", "/campaigns", "/characters/new", "/characters/new/", "/characters/mara/builder", "/characters/mara/builder/race", "/characters/mara/copy", "/characters/mara/sheet", "/dashboard/settings", "/characters-old"])(
    "keeps the unrelated route %s outside the migrated app frame", (pathname) => expect(isNotebookAppPath(pathname)).toBe(false),
  );
  it("keeps the narrower character-sheet predicate separate from shared overview pages", () => {
    expect(isCharacterNotebookPath("/dashboard")).toBe(false);
    expect(isCharacterNotebookPath("/characters")).toBe(false);
    expect(isCharacterNotebookPath("/characters/mara")).toBe(true);
    expect(isCharacterNotebookPath("/characters/new")).toBe(false);
    expect(isCharacterNotebookPath("/characters/new/")).toBe(false);
  });
});
