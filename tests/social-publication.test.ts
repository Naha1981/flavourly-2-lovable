import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  row: {
    status: "pending_approval",
    caption: "Synthetic QA",
    target_platforms: ["facebook"],
    media_urls: [],
    id: "qa",
  } as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
  claimFail: false,
}));
vi.mock("@/lib/db.server", () => ({
  db: async () => ({
    from: () => {
      let update: Record<string, unknown> | null = null;
      const filters: [string, unknown][] = [];
      const execute = () => {
        if (!update) return { data: { ...state.row }, error: null };
        if (state.claimFail || filters.some(([k, v]) => k === "status" && state.row[k] !== v))
          return { data: null, error: null };
        Object.assign(state.row, update);
        state.updates.push(update);
        return { data: { id: "qa" }, error: null };
      };
      const chain = {
        select: () => chain,
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return chain;
        },
        update: (p: Record<string, unknown>) => {
          update = p;
          return chain;
        },
        maybeSingle: async () => execute(),
        then: (resolve: (x: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return chain;
    },
  }),
}));
import { publishDraft } from "@/lib/openpost.server";
beforeEach(() => {
  state.row = {
    status: "pending_approval",
    caption: "Synthetic QA",
    target_platforms: ["facebook"],
    media_urls: [],
    id: "qa",
  };
  state.updates = [];
  state.claimFail = false;
  vi.unstubAllGlobals();
  process.env["OPENPOST_BASE_URL"] = "https://synthetic.invalid";
  process.env["OPENPOST_API_TOKEN"] = "synthetic";
  process.env["OPENPOST_WORKSPACE_ID"] = "qa";
  delete process.env["SOCIAL_PUBLISH_ENABLED"];
});
describe("social publication truth and duplicate guards", () => {
  it("defaults to approval only without an outbound call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const r = await publishDraft("qa", "qa");
    expect(r.ok).toBe(true);
    expect(state.row["status"]).toBe("approved");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not submit when the atomic claim loses", async () => {
    process.env["SOCIAL_PUBLISH_ENABLED"] = "true";
    state.claimFail = true;
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await publishDraft("qa", "qa")).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires every target to confirm published, not mere HTTP success", async () => {
    process.env["SOCIAL_PUBLISH_ENABLED"] = "true";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "provider-qa", status: "scheduled" }))),
    );
    await publishDraft("qa", "qa");
    expect(state.row["status"]).toBe("submitted");
  });
  it("treats partial success as unknown and prevents resubmission", async () => {
    process.env["SOCIAL_PUBLISH_ENABLED"] = "true";
    const fetch = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "provider-qa", status: "published" }), { status: 207 }),
    );
    vi.stubGlobal("fetch", fetch);
    await publishDraft("qa", "qa");
    expect(state.row["status"]).toBe("publication_unknown");
    expect((await publishDraft("qa", "qa")).ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("records timeout ambiguity rather than inviting a duplicate retry", async () => {
    process.env["SOCIAL_PUBLISH_ENABLED"] = "true";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    await publishDraft("qa", "qa");
    expect(state.row["status"]).toBe("publication_unknown");
  });
  it("marks published only with explicit all-platform confirmation", async () => {
    process.env["SOCIAL_PUBLISH_ENABLED"] = "true";
    const fetch = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            id: "provider-qa",
            status: "published",
            platforms: [{ platform: "facebook", status: "published" }],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetch);
    expect((await publishDraft("qa", "qa")).published).toBe(true);
    expect(state.row["status"]).toBe("published");
    expect(
      (fetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined)?.[
        "Idempotency-Key"
      ],
    ).toBe("flavourly:qa:qa");
  });
});
