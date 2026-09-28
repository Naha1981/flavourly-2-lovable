import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import {
  approveSocialDraft,
  generateSocialDraft,
  listSocialDrafts,
  rejectSocialDraft,
  type SocialDraft,
} from "@/lib/social.functions";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/social")({
  head: () => dashMeta("Social", "Review and approve posts before they go out."),
  component: SocialPage,
});

const STATUS: Record<string, string> = {
  pending_approval: "Waiting for approval",
  approved: "Approved, not yet published",
  published: "Published",
  rejected: "Rejected",
  drafted: "Draft",
};

function SocialPage() {
  const { profile, ready } = useRestaurantProfile();
  const tenantId = profile.slug;
  const list = useServerFn(listSocialDrafts);
  const generate = useServerFn(generateSocialDraft);
  const approve = useServerFn(approveSocialDraft);
  const reject = useServerFn(rejectSocialDraft);
  const [drafts, setDrafts] = useState<SocialDraft[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(
    async () => setDrafts(await list({ data: { tenantId } })),
    [list, tenantId],
  );
  useEffect(() => {
    if (ready) void reload();
  }, [ready, reload]);

  const run = async (
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string; note?: string }>,
  ) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      setMsg(r.ok ? (r.note ?? null) : (r.error ?? "Something went wrong."));
      await reload();
    } finally {
      setBusy(null);
    }
  };

  if (!ready || !drafts) return null;

  return (
    <>
      <PageTitle
        title="Social"
        sub="Posts are built from your in-stock best sellers. Nothing goes out until you approve it."
      />
      <Button
        onClick={() => run("new", () => generate({ data: { tenantId } }))}
        disabled={busy === "new"}
      >
        {busy === "new" ? "Drafting…" : "Draft a post"}
      </Button>
      {msg && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {msg}
        </p>
      )}

      <div className="mt-6 grid gap-4">
        {drafts.length === 0 && <p className="text-sm text-muted-foreground">No drafts yet.</p>}
        {drafts.map((d) => {
          const pending =
            d.status === "pending_approval" || d.status === "drafted" || d.status === "approved";
          const caption = edits[d.id] ?? d.caption;
          return (
            <article
              key={d.id}
              className="glass-card grid gap-3 rounded-2xl border border-border p-5"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {d.status === "published" ? (
                    <CheckCircle2 className="size-3.5 text-forest" />
                  ) : (
                    <Clock className="size-3.5" />
                  )}
                  {STATUS[d.status] ?? d.status} · {d.targetPlatforms.join(", ")}
                </span>
                <time dateTime={d.createdAt}>
                  {new Date(d.createdAt).toLocaleDateString("en-ZA")}
                </time>
              </div>
              {pending ? (
                <Textarea
                  aria-label="Caption"
                  rows={5}
                  value={caption}
                  onChange={(e) => setEdits({ ...edits, [d.id]: e.target.value })}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground">{d.caption}</p>
              )}
              {d.error && (
                <p role="alert" className="text-sm text-destructive">
                  {d.error}
                </p>
              )}
              {pending && (
                <div className="flex gap-2">
                  <Button
                    disabled={busy === d.id}
                    onClick={() =>
                      run(d.id, async () => {
                        const r = await approve({ data: { tenantId, draftId: d.id, caption } });
                        return r.ok
                          ? { ok: true, note: r.published ? "Published." : r.note }
                          : { ok: false, error: r.error };
                      })
                    }
                  >
                    {busy === d.id
                      ? "Working…"
                      : d.status === "approved"
                        ? "Retry publish"
                        : "Approve and publish"}
                  </Button>
                  {d.status !== "approved" && (
                    <Button
                      variant="outline"
                      disabled={busy === d.id}
                      onClick={() => run(d.id, () => reject({ data: { tenantId, draftId: d.id } }))}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
