/**
 * Tiny in-memory stand-in for the Supabase query builder, covering only the
 * calls the server code uses. Lets flow tests run without a real database.
 */
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export type FakeDb = ReturnType<typeof createFakeDb>;

/** Column defaults mirroring the real migrations, applied on insert. */
const DEFAULTS: Record<string, () => Row> = {
  outbox_jobs: () => ({ status: "pending", attempts: 0, automated: true, sent_at: null, error: null }),
  approval_requests: () => ({ status: "pending", requested_at: new Date().toISOString(), resolved_at: null, resolved_by: null }),
  wa_conversations: () => ({ status: "open", urgency: "medium", intent: "other", unread: 0 }),
  wa_webhook_events: () => ({ status: "processed", retry_count: 0, event_count: 0, saved: 0 }),
  tenant_profiles: () => ({ auto_replies_enabled: false, plan_tier: "starter", plan_status: "trialing" }),
  wa_opt_outs: () => ({ opted_out_at: new Date().toISOString(), source: "whatsapp_keyword" }),
};

export function createFakeDb(uniques: Record<string, string[][]> = {}) {
  const tables: Record<string, Row[]> = {};
  let seq = 0;
  const t = (name: string) => (tables[name] ??= []);

  function from(table: string) {
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let returning = false;
    let single: "one" | "maybe" | null = null;
    let limitN: number | null = null;
    const filters: Filter[] = [];

    const exec = () => {
      const rows = t(table);
      if (op === "insert") {
        const items = (Array.isArray(payload) ? payload : [payload!]).map((p) => ({
          id: `id-${++seq}`,
          created_at: new Date().toISOString(),
          ...(DEFAULTS[table]?.() ?? {}),
          ...p,
        }));
        for (const item of items) {
          for (const cols of uniques[table] ?? []) {
            if (cols.some((c) => (item as Record<string, unknown>)[c] == null)) continue;
            if (rows.some((r) => cols.every((c) => (r as Record<string, unknown>)[c] === (item as Record<string, unknown>)[c])))
              return { data: null, error: { code: "23505", message: "duplicate key" } };
          }
          rows.push(item);
        }
        const out = returning ? items : null;
        return { data: single && out ? out[0] : out, error: null };
      }
      if (op === "delete") {
        const keep = rows.filter((r) => !filters.every((f) => f(r)));
        tables[table] = keep;
        return { data: null, error: null };
      }
      let matched = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        for (const r of matched) Object.assign(r, payload);
      }
      if (limitN != null) matched = matched.slice(0, limitN);
      if (op === "update" && !returning) return { data: null, error: null };
      if (single) return { data: matched[0] ?? null, error: null };
      return { data: matched.map((r) => ({ ...r })), error: null };
    };

    const b = {
      select() { if (op !== "select") returning = true; return b; },
      insert(p: Row | Row[]) { op = "insert"; payload = p; return b; },
      update(p: Row) { op = "update"; payload = p; return b; },
      delete() { op = "delete"; return b; },
      eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return b; },
      neq(c: string, v: unknown) { filters.push((r) => r[c] !== v); return b; },
      in(c: string, v: unknown[]) { filters.push((r) => v.includes(r[c])); return b; },
      gte(c: string, v: string) { filters.push((r) => String(r[c]) >= v); return b; },
      lte(c: string, v: string) { filters.push((r) => String(r[c]) <= v); return b; },
      lt(c: string, v: string) { filters.push((r) => String(r[c]) < v); return b; },
      gt(c: string, v: string) { filters.push((r) => String(r[c]) > v); return b; },
      not(c: string, op2: string, v: unknown) { filters.push((r) => op2 === "is" ? r[c] !== v : true); return b; },
      order() { return b; },
      limit(n: number) { limitN = n; return b; },
      single() { single = "one"; return Promise.resolve(exec()); },
      maybeSingle() { single = "maybe"; return Promise.resolve(exec()); },
      then<T>(res: (v: ReturnType<typeof exec>) => T, rej?: (e: unknown) => T) {
        return Promise.resolve(exec()).then(res, rej);
      },
    };
    return b;
  }

  return { from, tables, rows: t };
}
