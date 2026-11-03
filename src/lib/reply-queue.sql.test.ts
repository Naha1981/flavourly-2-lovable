/* eslint-disable @typescript-eslint/no-explicit-any -- Disposable database and fluent client fixtures. */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let pg: PGlite;
const t = "disposable-queue-fixture";
const convo = "00000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE tenant_profiles(tenant_id text PRIMARY KEY,auto_replies_enabled boolean DEFAULT true);
 CREATE TABLE wa_channels(tenant_id text PRIMARY KEY,account_id text);
 CREATE TABLE wa_conversations(id uuid PRIMARY KEY,tenant_id text,assignee text,status text DEFAULT 'open',next_action text,last_message text,last_message_at timestamptz DEFAULT now());
 CREATE TABLE wa_messages(tenant_id text,conversation_id uuid,wa_message_id text,direction text,body text,sent_at timestamptz,delivery_status text,delivery_status_at timestamptz);
 CREATE TABLE wa_inbox_events(event_id text PRIMARY KEY,tenant_id text);
 CREATE TABLE wa_opt_outs(tenant_id text,phone text,PRIMARY KEY(tenant_id,phone));
 CREATE FUNCTION wa_ingest_inbox(p_tenant text,p_event text,p_message text,p_conversation text,p_phone text,p_name text,p_body text,p_sent timestamptz) RETURNS uuid LANGUAGE plpgsql AS $$
 DECLARE claimed text; BEGIN
 INSERT INTO wa_inbox_events VALUES(p_event,p_tenant) ON CONFLICT DO NOTHING RETURNING event_id INTO claimed;
 IF claimed IS NULL OR EXISTS(SELECT 1 FROM wa_messages WHERE tenant_id=p_tenant AND wa_message_id=p_message) THEN RETURN NULL; END IF;
 INSERT INTO wa_messages VALUES(p_tenant,'${convo}',p_message,'in',p_body,p_sent,NULL,NULL); RETURN '${convo}'; END $$;
 INSERT INTO tenant_profiles VALUES('${t}',true); INSERT INTO wa_channels VALUES('${t}','bound'); INSERT INTO wa_conversations(id,tenant_id) VALUES('${convo}','${t}');`);
  await pg.exec(
    readFileSync("supabase/migrations/20261103160000_durable_whatsapp_replies.sql", "utf8"),
  );
}, 30000);
afterAll(async () => pg.close());
async function inbound(event: string, message: string, body = "price?", standby = false) {
  return pg.query(
    `SELECT wa_ingest_inbox($1,$2,$3,'provider-conversation','27610000000','SYNTHETIC',$4,now(),$5) AS id`,
    [t, event, message, body, standby],
  );
}
async function scalar(sql: string) {
  return (await pg.query(sql)).rows[0] as any;
}
describe("durable reply queue SQL", () => {
  it("commits one job per inbound and duplicate event/message do not duplicate it", async () => {
    await inbound("e1", "m1");
    await inbound("e1", "m1");
    await inbound("e2", "m1");
    expect((await scalar("SELECT count(*)::int AS n FROM wa_reply_jobs")).n).toBe(1);
  });
  it("does not queue standby and STOP atomically blocks old queued work; START does not restart it", async () => {
    await inbound("es", "ms", "price?", true);
    await inbound("estop", "mstop", "STOP");
    expect((await scalar("SELECT state FROM wa_reply_jobs WHERE message_id='m1'")).state).toBe(
      "held",
    );
    expect((await scalar("SELECT count(*)::int AS n FROM wa_opt_outs")).n).toBe(1);
    await inbound("estart", "mstart", "START");
    expect((await scalar("SELECT state FROM wa_reply_jobs WHERE message_id='m1'")).state).toBe(
      "held",
    );
    expect((await scalar("SELECT count(*)::int AS n FROM wa_reply_jobs")).n).toBe(1);
  });
  it("job insert error rolls back inbox event AND message", async () => {
    await pg.exec(
      "CREATE FUNCTION reject_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_job BEFORE INSERT ON wa_reply_jobs FOR EACH ROW EXECUTE FUNCTION reject_job();",
    );
    await expect(inbound("efail", "mfail")).rejects.toThrow();
    expect(
      (await scalar("SELECT count(*)::int AS n FROM wa_inbox_events WHERE event_id='efail'")).n,
    ).toBe(0);
    expect(
      (await scalar("SELECT count(*)::int AS n FROM wa_messages WHERE wa_message_id='mfail'")).n,
    ).toBe(0);
    await pg.exec(
      "DROP TRIGGER reject_job ON wa_reply_jobs; UPDATE wa_reply_jobs SET state='superseded'; UPDATE wa_conversations SET status='open';",
    );
  });
  it("only one worker claims a conversation; interrupted preparation is held, not rerun", async () => {
    await inbound("e3", "m3");
    await inbound("e4", "m4");
    const j = (await pg.query("SELECT * FROM wa_claim_reply()")).rows[0] as any;
    expect(j.message_id).toBe("m3");
    expect((await pg.query("SELECT * FROM wa_claim_reply()")).rows).toHaveLength(0);
    expect(
      (
        await pg.query(
          "SELECT wa_begin_reply_send($1,'00000000-0000-0000-0000-000000000002','R20') AS ok",
          [j.id],
        )
      ).rows[0],
    ).toEqual({ ok: false });
    await pg.exec(
      "UPDATE wa_reply_jobs SET claimed_at=now()-interval '6 minutes' WHERE state='preparing'",
    );
    expect((await pg.query("SELECT * FROM wa_claim_reply()")).rows).toHaveLength(0);
    expect((await scalar("SELECT state FROM wa_reply_jobs WHERE message_id='m3'"))["state"]).toBe(
      "held",
    );
    expect(
      (await pg.query("SELECT wa_begin_reply_send($1,$2,'R20') AS ok", [j.id, j.claim_token]))
        .rows[0],
    ).toEqual({ ok: false });
  });
  it("interrupted sending is never automatically resent", async () => {
    await pg.exec(
      "UPDATE wa_reply_jobs SET state='superseded'; UPDATE wa_conversations SET status='open';",
    );
    await inbound("euncertain", "muncertain");
    const j = (await pg.query("SELECT * FROM wa_claim_reply()")).rows[0] as any;
    expect(
      (await pg.query("SELECT wa_begin_reply_send($1,$2,'R20') AS ok", [j.id, j.claim_token]))
        .rows[0],
    ).toEqual({ ok: true });
    await pg.exec(
      "UPDATE wa_reply_jobs SET claimed_at=now()-interval '6 minutes' WHERE state='sending'",
    );
    expect((await pg.query("SELECT * FROM wa_claim_reply()")).rows).toHaveLength(0);
    expect(
      (await scalar("SELECT state FROM wa_reply_jobs WHERE message_id='muncertain'"))["state"],
    ).toBe("held");
  });
  it("old eight-argument code saves without queueing, enabling a safe migration-first rollout", async () => {
    const before = (await scalar("SELECT count(*)::int AS n FROM wa_reply_jobs"))["n"];
    await pg.query(
      "SELECT wa_ingest_inbox($1,'old-event','old-message','provider-conversation','27610000000','SYNTHETIC','old code',now())",
      [t],
    );
    expect((await scalar("SELECT count(*)::int AS n FROM wa_reply_jobs"))["n"]).toBe(before);
  });
  it("persists acceptance first and reconciles early receipt once without any resend", async () => {
    await pg.exec(
      "UPDATE wa_reply_jobs SET state='superseded'; UPDATE wa_conversations SET status='open';",
    );
    await inbound("e5", "m5");
    const j = (await pg.query("SELECT * FROM wa_claim_reply()")).rows[0] as any;
    await pg.query("SELECT wa_begin_reply_send($1,$2,'SYNTHETIC Tea R20')", [j.id, j.claim_token]);
    await pg.query("SELECT wa_record_delivery($1,'receipt1','provider-reply','delivered',now())", [
      t,
    ]);
    await pg.query("SELECT wa_accept_reply($1,$2,'provider-reply')", [j.id, j.claim_token]);
    expect((await scalar("SELECT state FROM wa_reply_jobs WHERE message_id='m5'")).state).toBe(
      "accepted",
    );
    await pg.query("SELECT wa_reconcile_reply($1)", [j.id]);
    await pg.query("SELECT wa_reconcile_reply($1)", [j.id]);
    expect(
      (await scalar("SELECT count(*)::int AS n FROM wa_messages WHERE direction='out'")).n,
    ).toBe(1);
    expect(
      (await scalar("SELECT delivery_status FROM wa_messages WHERE direction='out'"))
        .delivery_status,
    ).toBe("delivered");
  });
  it("synthetic isolation saves normal chats without scheduling replies", async () => {
    const tenant = "synthetic-isolation-fixture";
    await pg.query("INSERT INTO tenant_profiles VALUES($1,true);", [tenant]);
    await pg.query("INSERT INTO wa_channels VALUES($1,'test-only')", [tenant]);
    await pg.query(
      "SELECT wa_ingest_inbox($1,'isolation-event','isolation-message','conv','000000','SYNTHETIC','hello',now(),false)",
      [tenant],
    );
    expect(
      (
        await scalar(
          "SELECT count(*)::int AS n FROM wa_reply_jobs WHERE tenant_id='synthetic-isolation-fixture'",
        )
      )["n"],
    ).toBe(0);
  });
  it("rechecks opt-out and binding immediately before send", async () => {
    await pg.exec(
      "UPDATE wa_reply_jobs SET state='superseded'; UPDATE wa_conversations SET status='open';",
    );
    await inbound("egate", "mgate");
    const j = (await pg.query("SELECT * FROM wa_claim_reply()")).rows[0] as any;
    await pg.query("INSERT INTO wa_opt_outs VALUES($1,'27610000000')", [t]);
    expect(
      (await pg.query("SELECT wa_begin_reply_send($1,$2,'R20') AS ok", [j.id, j.claim_token]))
        .rows[0],
    ).toEqual({ ok: false });
    await pg.exec("DELETE FROM wa_opt_outs;UPDATE wa_channels SET account_id='changed'");
    expect(
      (await pg.query("SELECT wa_begin_reply_send($1,$2,'R20') AS ok", [j.id, j.claim_token]))
        .rows[0],
    ).toEqual({ ok: false });
  });
  it("table and functions are inaccessible to browsers", async () => {
    expect(
      (
        await scalar(
          "SELECT has_table_privilege('authenticated','wa_reply_jobs','SELECT') AS access",
        )
      ).access,
    ).toBe(false);
    expect(
      (await scalar("SELECT has_function_privilege('anon','wa_claim_reply()','EXECUTE') AS access"))
        .access,
    ).toBe(false);
  });
});
