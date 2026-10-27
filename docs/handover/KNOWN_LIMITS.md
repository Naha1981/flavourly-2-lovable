# Known limits: read this before you sign off, and share it with the client

Honest list of what Flavourly does not do, or does imperfectly. Nothing here is a surprise defect; each item has a reason and a mitigation.

## Business and platform risk

| Limit | Why it matters | Mitigation |
|---|---|---|
| **WhatsApp runs on an unofficial connection** (a Baileys-based operator, not the official Business API) | WhatsApp can block a number, especially after spam reports or high volume. A blocked number stops all messaging for that restaurant. | Opt-out is honoured, automated sends respect quiet hours and quotas. Tell clients plainly. If a client needs a guarantee, the answer is the official WhatsApp Business API (paid per conversation). |
| **Third-party outages** (Supabase, Lovable, PayFast, the WhatsApp operator, the AI gateway) | The app is down or degraded when they are. | `/api/public/health` and alerts tell you. Nothing in the app can fix a provider outage. |
| **Free-tier infrastructure** | Supabase free projects pause when idle; limits apply. | Confirm the plan and backup setting (`OWNER_CHECKLIST.md`). |
| **AI answers can be wrong** | Replies, triage and the revenue agent are generated text. | Sensitive messages require approval; the manager can reject anything. Prompt-injection hardening of the AI prompts has **not** been reviewed. |

## Product behaviour

- **Geo-claims trust the guest's phone location.** Location can be faked. Treat the geofence as a soft control. Vouchers are one-time use and redemption is atomic, so the damage is bounded.
- **Manual replies only reach guests who have already messaged the restaurant.** Opt-out is deliberately *not* checked for these (a reply to a guest who is talking to you is transactional). Bulk and automated messages do check opt-out.
- **A message interrupted mid-send is marked failed, not retried.** We cannot know whether it reached the guest; retrying could send it twice. It appears in the failure alert.
- **No staff-management screen.** Adding or removing people is SQL (see `ROLES.md`).
- **The revenue agent processes at most 100 restaurants per run.** An alert fires when the limit is hit.
- **Daily jobs depend on an external scheduler.** If it stops, you are alerted (health check + watchdog), but nothing inside the app can restart it.
- **The same-isolate alert throttle is per server instance.** The watchdog adds a durable once-per-6-hours throttle, so alert floods are bounded, but a burst from different instances can send a few duplicates.

## Engineering debt

- **zod advisory:** one known high-severity vulnerability remains (zod memory exhaustion on oversized constrained collections). Upgrading zod 3 to 4 is a breaking change, so it is deferred. Input arrays are bounded and every endpoint now requires login or a secret.
- **`src/integrations/supabase/types.ts` is stale** (missing tables from later migrations); Lovable regenerates it. `db()` in `db.server.ts` is therefore an untyped client for most queries.
- **Nitro is pinned to a beta release** and `rolldown` is overridden: expect occasional upgrade work.
- **WhatsApp tenant-token refresh** (`ensureTenantToken`) could in theory rotate a token from two server instances at once, causing one transient failed call. Not observed; not fixed.
- **No rate limit** on the public claim endpoints (tokens are 128-bit random, so guessing is not feasible; abuse would be volume only).
- **Not independently reviewed:** UI components, the AI prompt files, outbound provider adapters for SSRF, accessibility, and performance under load.

## What has NOT been proven against the real world

- PayFast signing, notification and cancel flows were tested against fixtures built from PayFast's published rules. A **sandbox subscription end to end** (`ACCEPTANCE_SCRIPT.md` step 7) is the real proof and is still owed.
- The migrations were replayed on a clean Postgres 16 with Supabase's roles and `auth` schema stubbed, not on a live Supabase project.
- Alert delivery was tested with a fake endpoint, not your real channel.
