import { db } from "./db.server";

/** Approval and publication are different outcomes. Ambiguous attempts never auto-retry. */
export async function publishDraft(tenantId: string, draftId: string, editedCaption?: string) {
  const c = await db();
  const { data: draft, error: readError } = await c
    .from("social_content_drafts")
    .select("id, caption, media_urls, target_platforms, status")
    .eq("tenant_id", tenantId)
    .eq("id", draftId)
    .maybeSingle();
  if (readError) return { ok: false as const, error: "Draft could not be loaded." };
  if (!draft) return { ok: false as const, error: "Draft not found." };
  if (!["drafted", "pending_approval", "approved"].includes(draft.status))
    return {
      ok: false as const,
      error: "This draft cannot be submitted again. Check its existing publication result.",
    };
  const caption = editedCaption ?? (draft.caption as string);
  const base = process.env["OPENPOST_BASE_URL"];
  const token = process.env["OPENPOST_API_TOKEN"];
  const workspace = process.env["OPENPOST_WORKSPACE_ID"];
  const enabled =
    process.env["SOCIAL_PUBLISH_ENABLED"] === "true" && !!base && !!token && !!workspace;
  const { data: claimed, error: claimError } = await c
    .from("social_content_drafts")
    .update({
      status: enabled ? "submitting" : "approved",
      caption,
      approved_at: new Date().toISOString(),
      error: null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", draftId)
    .eq("status", draft.status)
    .select("id")
    .maybeSingle();
  if (claimError || !claimed)
    return {
      ok: false as const,
      error: "Draft changed or could not be saved. Reload before trying again.",
    };
  if (!enabled)
    return {
      ok: true as const,
      published: false as const,
      note: "Approved, not published. Automatic publishing is off or its connector is not configured.",
    };
  try {
    const res = await fetch(
      `${base!.replace(/\/$/, "")}/workspaces/${encodeURIComponent(workspace!)}/posts`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `flavourly:${tenantId}:${draftId}`,
        },
        body: JSON.stringify({
          caption,
          platforms: draft.target_platforms,
          media_urls: draft.media_urls,
          publish_now: true,
        }),
      },
    );
    const body = (await res.json().catch(() => null)) as {
      id?: string;
      status?: string;
      platforms?: Array<{ platform?: string; status?: string }>;
    } | null;
    const targets = draft.target_platforms as string[];
    const published =
      res.ok &&
      res.status !== 207 &&
      !!body?.id &&
      body.status === "published" &&
      targets.length > 0 &&
      targets.every((target) =>
        body.platforms?.some((p) => p.platform === target && p.status === "published"),
      );
    const status = published
      ? "published"
      : res.ok && res.status !== 207 && body?.id
        ? "submitted"
        : "publication_unknown";
    const { error } = await c
      .from("social_content_drafts")
      .update({
        status,
        openpost_post_id: body?.id ?? null,
        error: published
          ? null
          : "Publication not confirmed on every target platform. Reconcile the provider result before any retry.",
      })
      .eq("tenant_id", tenantId)
      .eq("id", draftId)
      .eq("status", "submitting");
    if (error) throw new Error("Result could not be saved");
    return {
      ok: true as const,
      published,
      note: published
        ? "Published on every target platform."
        : "Submitted or result uncertain. Not confirmed published; automatic retry is blocked.",
    };
  } catch {
    await c
      .from("social_content_drafts")
      .update({
        status: "publication_unknown",
        error:
          "Publication result is unknown. Check the provider before retrying; the post may already exist.",
      })
      .eq("tenant_id", tenantId)
      .eq("id", draftId)
      .eq("status", "submitting");
    return {
      ok: false as const,
      error: "Publication result is unknown. No automatic retry will be made.",
    };
  }
}
