# Billing and database gates, 2 November 2026

## Code-only candidate
- Health no longer uses the deprecated OPERATOR_URL as a WhatsApp dependency. Paused or unconfigured transport stays non-green. When enabled, a bounded read of the current Zernio account endpoint checks reachability only, not delivery or free capacity.
- Public health suppresses raw database error text.
- Owner privacy export reports only a safe code reference, not SQL, hints, tenant data or secret messages. Failed export stays failed, with no partial download.
- Billing distinguishes the current pilot offer from existing subscription contracts. Prices, legacy amounts, PayFast verification, checkout pause and switches are unchanged.

## Live findings at 10:33 SAST
- Approved readiness batch now serves, including correct email/061 contact and activation panel.
- Synthetic owner: all WhatsApp/AI switches paused; Zernio and Groq not configured; no account linked; allowance RPC PGRST202.
- Synthetic owner export still fails. No deletion attempted.
- Database reachable. Four observed cron heartbeats fresh, Revenue Employee never observed. Old health dependency returns 429 and is not evidence of Zernio failure.

## Prepared separately, NOT applied
- Idempotent service-only allowance read plus atomic reserve replacement, matching existing migration limits, with schema-cache reload.
- Idempotent owner-only privacy-export function and grants, no deletion function or trigger changes.
- Disposable PostgreSQL applies both twice; 32 assertions prove read, owner export, 25 daily reservations, blocked 26th and unprivileged rejection. This is not proof of production schema compatibility or concurrency.
- Production needs verified owner database/editor access, schema inspection and applicable exact approval before migration. No SQL work is delegated to Thabiso.

## Still not ready
Production database repair, atomic concurrent-send acceptance, privacy export acceptance, payment sandbox lifecycle, WhatsApp dedicated-number/free-capacity/signed-inbound/STOP/handoff/delivery acceptance remain open. No paid action, provider activation, scheduler change or outbound send is authorized by this document.
