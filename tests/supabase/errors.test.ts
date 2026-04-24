import { describe, it, expect, vi } from "vitest";
import { reportClientError } from "@/lib/supabase/errors";

describe("reportClientError", () => {
  it("returns early (no insert) when message is empty", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert: insertMock })) };
    await reportClientError(supabase, "user-1", { source: "manual", message: "" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns early when message is whitespace only", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert: insertMock })) };
    await reportClientError(supabase, "user-1", { source: "manual", message: "   \n " });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("inserts message + stack + source + user id", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert: insertMock })) };
    await reportClientError(supabase, "user-1", {
      source: "client_boundary",
      message: "Component exploded",
      stack: "at Component\n  at render",
      pageUrl: "/dashboard",
      userAgent: "Mozilla/5.0",
      context: { featureFlag: "rest_v2" },
    });
    expect(supabase.from).toHaveBeenCalledWith("app_errors");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        source: "client_boundary",
        message: "Component exploded",
        stack: "at Component\n  at render",
        page_url: "/dashboard",
        user_agent: "Mozilla/5.0",
        context: { featureFlag: "rest_v2" },
      }),
    );
  });

  it("truncates very long messages to 5000 chars", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert: insertMock })) };
    const longMessage = "x".repeat(6000);
    await reportClientError(supabase, "user-1", {
      source: "client_unhandled",
      message: longMessage,
    });
    const call = insertMock.mock.calls[0][0];
    expect(call.message.length).toBe(5000);
  });

  it("truncates very long stacks to 10000 chars", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert: insertMock })) };
    const longStack = "y".repeat(15000);
    await reportClientError(supabase, "user-1", {
      source: "client_unhandled",
      message: "boom",
      stack: longStack,
    });
    const call = insertMock.mock.calls[0][0];
    expect(call.stack.length).toBe(10000);
  });

  it("defaults optional fields to null", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert: insertMock })) };
    await reportClientError(supabase, "user-1", {
      source: "manual",
      message: "just a report",
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: null,
        page_url: null,
        user_agent: null,
        context: null,
      }),
    );
  });

  it("swallows insert errors without throwing (best-effort)", async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockRejectedValue(new Error("network dead")),
      })),
    };
    await expect(
      reportClientError(supabase, "user-1", { source: "manual", message: "boom" }),
    ).resolves.toBeUndefined();
  });
});
