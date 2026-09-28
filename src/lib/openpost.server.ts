import { db } from "./db.server";

/**
 * Approve a draft and hand it to OpenPost. Never marks a post "published" unless
 * OpenPost actually accepted it: without credentials the draft stays "approved".
 */
export async function publishDraft(tenantId: string, draftId: string, editedCaption?: string) {
  const c = await db();
  const { data: draft } = await c
    .from("social_content_drafts")
    .select("id, caption, media_urls, target_platforms, status")
    .eq("tenant_id", tenantId)
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { ok: false as const, error: "Draft not found." };
  if (draft.status === "published") return { ok: false as const, error: "Already published." };

  const caption = editedCaption ?? (draft.caption as string);
  const now = new Date().toISOString();
  await c
    .from("social_content_drafts")
    .update({ status: "approved", caption, approved_at: now, error: null })
    .eq("id", draftId);

  const base = process.env["OPENPOST_BASE_URL"];
  const token = process.env["OPENPOST_API_TOKEN"];
  const workspace = process.env["OPENPOST_WORKSPACE_ID"];
  if (!base || !token || !workspace) {
    return {
      ok: true as const,
      published: false as const,
      note: "Approved. Connect OpenPost to publish automatically.",
    };
  }

  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/workspaces/${encodeURIComponent(workspace)}/posts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          platforms: draft.target_platforms,
          media_urls: draft.media_urls,
          publish_now: true,
        }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    if (!res.ok) throw new Error(`OpenPost responded ${res.status}`);
    await c
      .from("social_content_drafts")
      .update({ status: "published", openpost_post_id: body.id ?? null })
      .eq("id", draftId);
    return { ok: true as const, published: true as const };
  } catch (e) {
    console.error("openpost publish failed", e);
    await c
      .from("social_content_drafts")
      .update({ error: "OpenPost couldn't publish this post. Try again." })
      .eq("id", draftId);
    return {
      ok: false as const,
      error: "OpenPost couldn't publish this post. It's saved as approved; try again.",
    };
  }
}
