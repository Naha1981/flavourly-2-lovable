import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
let pg: PGlite;
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const call = (name: string, tenant = "qa-a", actor = owner) =>
  pg.query(`SELECT public.${name}($1,$2) AS result`, [tenant, actor]);
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;`,
  );
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const f of readdirSync(dir).sort()) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  await pg.exec(
    `INSERT INTO tenant_profiles(tenant_id,name) VALUES('qa-a','Synthetic QA A'),('qa-b','Synthetic QA B');INSERT INTO auth.users VALUES('${owner}'),('${other}');INSERT INTO tenant_members(tenant_id,user_id,role) VALUES('qa-a','${owner}','owner'),('qa-b','${other}','owner');INSERT INTO menu_categories(tenant_id,name) VALUES('qa-a','Synthetic menu A'),('qa-b','Synthetic menu B');`,
  );
}, 30000);
afterAll(async () => pg?.close());
describe("privacy RPCs on disposable PostgreSQL engine", () => {
  it("applies every migration and exports only the owning workspace", async () => {
    const r = await call("privacy_export_workspace");
    const s = JSON.stringify(r.rows);
    expect(s).toContain("Synthetic menu A");
    expect(s).not.toContain("Synthetic menu B");
  });
  it("rejects a different owner and unprivileged roles", async () => {
    for (const f of ["privacy_export_workspace", "privacy_delete_workspace"])
      await expect(call(f, "qa-a", other)).rejects.toThrow("Owner access required");
    await pg.exec("SET ROLE authenticated");
    await expect(call("privacy_export_workspace")).rejects.toThrow("permission denied");
    await pg.exec("RESET ROLE");
  });
  it("blocks active billing before any deletion", async () => {
    await pg.exec("UPDATE tenant_profiles SET plan_status='active' WHERE tenant_id='qa-a'");
    await expect(call("privacy_delete_workspace")).rejects.toThrow("Cancel and verify");
    expect(
      (await pg.query("SELECT count(*)::int AS n FROM menu_categories WHERE tenant_id='qa-a'"))
        .rows,
    ).toEqual([{ n: 1 }]);
    await pg.exec("UPDATE tenant_profiles SET plan_status='trialing' WHERE tenant_id='qa-a'");
  });
  it("rejects schema drift for export and deletion", async () => {
    await pg.exec("CREATE TABLE unreviewed_test(tenant_id text)");
    for (const f of ["privacy_export_workspace", "privacy_delete_workspace"])
      await expect(call(f)).rejects.toThrow("Unreviewed tenant table");
    await pg.exec("DROP TABLE unreviewed_test");
  });
  it("blocks in-flight work", async () => {
    await pg.exec(
      "INSERT INTO outbox_jobs(tenant_id,recipient_phone,message_text,status) VALUES('qa-a','synthetic','Synthetic QA','processing')",
    );
    await expect(call("privacy_delete_workspace")).rejects.toThrow("In-flight work");
    await pg.exec("UPDATE outbox_jobs SET status='pending' WHERE tenant_id='qa-a'");
  });
  it("rolls back earlier deletes if a later table fails", async () => {
    await pg.exec(
      `CREATE FUNCTION privacy_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic failure';END;$$;CREATE TRIGGER privacy_test_failure BEFORE DELETE ON menu_categories FOR EACH ROW EXECUTE FUNCTION privacy_test_failure();`,
    );
    await expect(call("privacy_delete_workspace")).rejects.toThrow("Synthetic failure");
    expect(
      (await pg.query("SELECT count(*)::int AS n FROM outbox_jobs WHERE tenant_id='qa-a'")).rows,
    ).toEqual([{ n: 1 }]);
    await pg.exec(
      "DROP TRIGGER privacy_test_failure ON menu_categories;DROP FUNCTION privacy_test_failure()",
    );
  });
  it("deletes one workspace atomically and preserves the other and login", async () => {
    expect(JSON.stringify((await call("privacy_delete_workspace")).rows)).toContain(
      '"deleted":true',
    );
    expect((await pg.query("SELECT tenant_id FROM tenant_profiles ORDER BY 1")).rows).toEqual([
      { tenant_id: "qa-b" },
    ]);
    expect((await pg.query("SELECT tenant_id FROM menu_categories ORDER BY 1")).rows).toEqual([
      { tenant_id: "qa-b" },
    ]);
    expect((await pg.query("SELECT count(*)::int AS n FROM auth.users")).rows).toEqual([{ n: 2 }]);
  });
  it("prevents a stale job recreating a deleted workspace", async () => {
    await expect(
      pg.exec("INSERT INTO menu_categories(tenant_id,name) VALUES('qa-a','Stale synthetic job')"),
    ).rejects.toThrow("Workspace was permanently deleted");
    await expect(
      pg.exec(
        "INSERT INTO tenant_profiles(tenant_id,name) VALUES('qa-a','Stale synthetic recreation')",
      ),
    ).rejects.toThrow("Workspace was permanently deleted");
    await pg.exec(
      "INSERT INTO menu_categories(tenant_id,name) VALUES('qa-b','Synthetic other tenant')",
    );
  });
});
