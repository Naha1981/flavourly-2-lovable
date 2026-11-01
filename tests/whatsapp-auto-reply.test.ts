import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "./helpers/fake-db";
const state = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof createFakeDb>,
  draft: vi.fn(),
  send: vi.fn(),
  booking: vi.fn(),
}));
vi.mock("@/lib/db.server", () => ({ db: async () => state.db, APP_URL: () => "" }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state.db, APP_URL: () => "" }));
vi.mock("@/lib/wa-account.server", () => ({
  sendWhatsApp: (...args: unknown[]) => state.send(...args),
}));
vi.mock("../src/lib/wa-account.server", () => ({
  sendWhatsApp: (...args: unknown[]) => state.send(...args),
}));
vi.mock("@/lib/reply-drafts.server", () => ({
  generateReplyDraft: (...args: unknown[]) => state.draft(...args),
  buildMenuFacts: (rows: { name: string }[]) => rows.map((r) => r.name).join(","),
}));
vi.mock("../src/lib/reply-drafts.server", () => ({
  generateReplyDraft: (...args: unknown[]) => state.draft(...args),
  buildMenuFacts: (rows: { name: string }[]) => rows.map((r) => r.name).join(","),
}));
vi.mock("@/lib/booking/machine.server", () => ({
  handleBookingMessage: (...args: unknown[]) => state.booking(...args),
}));
vi.mock("../src/lib/booking/machine.server", () => ({
  handleBookingMessage: (...args: unknown[]) => state.booking(...args),
}));
vi.mock("@/lib/waitlist.server", () => ({ handleWaitlistReply: async () => null }));
vi.mock("../src/lib/waitlist.server", () => ({ handleWaitlistReply: async () => null }));
vi.mock("@/lib/reputation.server", () => ({ handleFeedbackReply: async () => null }));
vi.mock("../src/lib/reputation.server", () => ({ handleFeedbackReply: async () => null }));
vi.mock("@/lib/reminders.server", () => ({ handleReminderReply: async () => null }));
vi.mock("../src/lib/reminders.server", () => ({ handleReminderReply: async () => null }));
import { autoReply } from "@/lib/auto-reply.server";
const input = {
  tenantId: "venue-a",
  phone: "27821234567",
  name: "Guest",
  text: "menu please",
  conversationId: "convo-a",
  waAccountId: "account-a",
  waMessageId: "message-a",
};
beforeEach(() => {
  state.db = createFakeDb();
  state.db
    .rows("tenant_profiles")
    .push({ tenant_id: "venue-a", name: "Venue A", auto_replies_enabled: true });
  state.db
    .rows("wa_conversations")
    .push({ tenant_id: "venue-a", id: "convo-a", status: "open", assignee: null });
  state.db
    .rows("menu_items")
    .push(
      { tenant_id: "venue-a", name: "Venue A dish" },
      { tenant_id: "venue-b", name: "Private venue B dish" },
    );
  state.draft
    .mockReset()
    .mockResolvedValue({ ok: true, intent: "faq", reply: "Venue A dish is on our menu." });
  state.send.mockReset().mockResolvedValue({ ok: true, data: { messageId: "out-a" } });
  state.booking.mockReset().mockResolvedValue({ handled: false });
});
describe("restaurant inbox reply workflows", () => {
  it("uses only the current tenant menu in the draft", async () => {
    expect((await autoReply(input)).replied).toBe(true);
    expect(state.draft.mock.calls[0]?.[0].menuFacts).toBe("Venue A dish");
    expect(state.draft.mock.calls[0]?.[0].restaurant.name).toBe("Venue A");
  });
  for (const text of ["manager please", "I have allergies", "I want a refund", "a complaint"])
    it(`pauses for a person: ${text}`, async () => {
      expect((await autoReply({ ...input, text })).heldForApproval).toBe(true);
      expect(state.draft).not.toHaveBeenCalled();
      expect(state.send).not.toHaveBeenCalled();
      expect(state.db.rows("wa_conversations")[0]?.["status"]).toBe("needs_approval");
    });
  it("does not interrupt an assigned human conversation", async () => {
    state.db.rows("wa_conversations")[0]!["assignee"] = "Manager";
    await autoReply(input);
    expect(state.draft).not.toHaveBeenCalled();
    expect(state.send).not.toHaveBeenCalled();
  });
  it("holds a failed reply for approval, never queues an automatic retry", async () => {
    state.send.mockResolvedValue({ ok: false, error: "paused" });
    await autoReply(input);
    expect(state.db.rows("outbox_jobs")[0]?.["status"]).toBe("approval_required");
    expect(state.db.rows("approval_requests")).toHaveLength(1);
  });
  it("reads recorded visits and VIP without awarding anything", async () => {
    state.db
      .rows("customers")
      .push(
        { tenant_id: "venue-a", phone: input.phone, visit_count: 5, is_vip: true },
        { tenant_id: "venue-b", phone: input.phone, visit_count: 90, is_vip: false },
      );
    await autoReply({ ...input, text: "VIP" });
    expect(state.send.mock.calls[0]?.[2]).toContain("5 recorded visits");
    expect(state.send.mock.calls[0]?.[2]).toContain("active");
    expect(state.db.rows("loyalty_ledger")).toHaveLength(0);
  });
});
