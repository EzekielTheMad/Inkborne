import { describe, it, expect, vi } from "vitest";
import { submitFeedback } from "@/lib/supabase/feedback";

describe("submitFeedback", () => {
  it("returns error when text is empty", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    };
    const result = await submitFeedback(supabase, "user-1", { text: "" });
    expect(result).toMatch(/required/i);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns error when text is whitespace only", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    };
    const result = await submitFeedback(supabase, "user-1", { text: "   \n  " });
    expect(result).toMatch(/required/i);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("inserts with trimmed text + null tag + user id", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({ insert: insertMock })),
    };
    const result = await submitFeedback(supabase, "user-1", {
      text: "  this is a bug  ",
    });
    expect(result).toBeNull();
    expect(supabase.from).toHaveBeenCalledWith("feedback");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        text: "this is a bug",
        tag: null,
        page_url: null,
        user_agent: null,
      }),
    );
  });

  it("passes through tag, page_url, user_agent when provided", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({ insert: insertMock })),
    };
    await submitFeedback(supabase, "user-2", {
      text: "feature idea",
      tag: "feature",
      pageUrl: "/characters/abc",
      userAgent: "Mozilla/5.0",
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-2",
        tag: "feature",
        text: "feature idea",
        page_url: "/characters/abc",
        user_agent: "Mozilla/5.0",
      }),
    );
  });

  it("returns the error message string when insert fails", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: { message: "RLS denied" } }),
      })),
    };
    const result = await submitFeedback(supabase, "user-1", { text: "bad" });
    expect(result).toBe("RLS denied");
  });

  it("falls back to generic error when insert error has no message", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: {} }),
      })),
    };
    const result = await submitFeedback(supabase, "user-1", { text: "bad" });
    expect(result).toMatch(/failed/i);
  });
});
