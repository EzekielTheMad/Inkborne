import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/00051_campaign_page_content_documents.sql"),
  "utf8",
);

describe("campaign page content migration", () => {
  it("normalizes and constrains campaign content as TipTap documents", () => {
    expect(migration).toContain(`ALTER COLUMN content SET DEFAULT`);
    expect(migration).toContain(`SET content = '{"type":"doc","content":[]}'::jsonb`);
    expect(migration).toContain("campaign_pages_content_document");
    expect(migration).toContain("VALIDATE CONSTRAINT campaign_pages_content_document");
  });

  it("keeps null RPC content on the valid empty document shape", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_campaign_page");
    expect(migration).toContain("COALESCE(");
    expect(migration).toContain(`'{"type":"doc","content":[]}'::jsonb`);
  });
});
