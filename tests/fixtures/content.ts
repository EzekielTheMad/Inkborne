import type { Effect } from "@/lib/types/effects";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

export interface ContentDefinitionFixture {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  version: number;
  source: "srd" | "homebrew";
  data: Record<string, unknown>;
  effects: Effect[];
}

/**
 * Build a fixture for a content_definitions row. Every required field has a
 * sane default; pass `overrides` to set only what the test cares about.
 */
export function makeContentDefinition(
  overrides: Partial<ContentDefinitionFixture> = {},
): ContentDefinitionFixture {
  return {
    id: "fixture-content-id",
    name: "Fixture Content",
    slug: "fixture-content",
    content_type: "feature",
    version: 1,
    source: "srd",
    data: {},
    effects: [],
    ...overrides,
  };
}

/**
 * Build a fixture for a character_content_refs row joined with its
 * content_definitions row. Shape matches what supabase returns from a
 * `select("*, content_definitions(...)")` query.
 */
export function makeContentRef(
  overrides: Partial<Omit<ContentRefWithContent, "content_definitions">> & {
    content_definitions?: Partial<ContentDefinitionFixture>;
  } = {},
): ContentRefWithContent {
  const { content_definitions: cdOverrides, ...rest } = overrides;
  return {
    id: "fixture-ref-id",
    character_id: "fixture-character-id",
    content_id: "fixture-content-id",
    content_version: 1,
    context: {},
    choice_source: null,
    created_at: "2026-05-19T00:00:00Z",
    content_definitions: makeContentDefinition(cdOverrides),
    ...rest,
  } as ContentRefWithContent;
}
