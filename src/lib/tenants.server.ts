import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 500;

/**
 * Every tenant, paged. A bare .limit(N) silently drops restaurants once the
 * fleet grows past N - cron jobs must serve all of them.
 */
export async function listAllTenants<T extends string>(
  c: Pick<SupabaseClient, "from">,
  columns: T,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await c
      .from("tenant_profiles")
      .select(columns)
      .order("tenant_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}

/**
 * Cron resumability watermarks. Each recurring job records the last tenant it
 * completed so the next invocation resumes AFTER it instead of restarting at
 * the head of the fleet (which would starve the tail forever when runs are
 * time- or count-bounded). Stored in the small cron_state table; a missing
 * row or table degrades to "start from the beginning" - never a failure.
 */
export async function getCronWatermark(
  c: Pick<SupabaseClient, "from">,
  job: string,
): Promise<string | null> {
  try {
    const { data, error } = await c
      .from("cron_state")
      .select("last_tenant")
      .eq("job", job)
      .maybeSingle();
    if (error) return null;
    return (data?.last_tenant as string | null | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function setCronWatermark(
  c: Pick<SupabaseClient, "from">,
  job: string,
  lastTenant: string,
): Promise<void> {
  try {
    await c.from("cron_state").delete().eq("job", job);
    await c.from("cron_state").insert({ job, last_tenant: lastTenant, updated_at: new Date().toISOString() });
  } catch {
    // Watermark loss only causes re-processing, never skipped tenants.
  }
}

/** Rotate an ordered tenant list to start just after `lastTenant`, wrapping once. */
export function rotateAfter<T>(rows: T[], key: (row: T) => string, lastTenant: string | null): T[] {
  if (!lastTenant) return rows;
  const after = rows.filter((r) => key(r) > lastTenant);
  const before = rows.filter((r) => key(r) <= lastTenant);
  return [...after, ...before];
}
