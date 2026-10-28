import { describe, expect, it } from "vitest";

import { listAllTenants } from "@/lib/tenants.server";

// Synthetic supabase-style client over an in-memory tenant_profiles table.
function mockClient(rows: { tenant_id: string; name?: string }[]) {
  const sorted = [...rows].sort((a, b) => a.tenant_id.localeCompare(b.tenant_id));
  const calls: { from: number; to: number }[] = [];
  const chain = {
    select: () => chain,
    order: () => chain,
    range: (from: number, to: number) => {
      calls.push({ from, to });
      return Promise.resolve({ data: sorted.slice(from, to + 1), error: null });
    },
  };
  return { from: () => chain, calls };
}

describe("listAllTenants", () => {
  it("returns every tenant across multiple pages (fleet larger than one page)", async () => {
    const fleet = Array.from({ length: 1200 }, (_, i) => ({
      tenant_id: `r-${String(i).padStart(4, "0")}`,
    }));
    const client = mockClient(fleet);
    const tenants = await listAllTenants(client as never, "tenant_id");
    expect(tenants).toHaveLength(1200);
    expect(tenants[0]!["tenant_id"]).toBe("r-0000");
    expect(tenants[1199]!["tenant_id"]).toBe("r-1199");
    expect(client.calls.length).toBe(3); // 500 + 500 + 200
  });

  it("does not silently cap at 100 tenants (the old cron bug)", async () => {
    const fleet = Array.from({ length: 150 }, (_, i) => ({ tenant_id: `t${i}` }));
    const tenants = await listAllTenants(mockClient(fleet) as never, "tenant_id, name");
    expect(tenants).toHaveLength(150);
  });

  it("returns an empty list for an empty fleet", async () => {
    const tenants = await listAllTenants(mockClient([]) as never, "tenant_id");
    expect(tenants).toEqual([]);
  });

  it("throws on a database error instead of serving a partial fleet", async () => {
    const chain = {
      select: () => chain,
      order: () => chain,
      range: () => Promise.resolve({ data: null, error: new Error("db down") }),
    };
    await expect(listAllTenants({ from: () => chain } as never, "tenant_id")).rejects.toThrow(
      "db down",
    );
  });
});
