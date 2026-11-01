# WhatsApp allowance acceptance

Migration: `20261101032000_whatsapp_plan_allowances.sql`.

Local PostgreSQL checks: Starter/Growth/Pro monthly limits 500/1000/2500; trial100 across month rollover; daily25; missing/inactive/expired profiles fail closed; final-slot concurrent attempts reserve only once; tenant separation; server-only usage RPC. SQL verification script in this folder requires the separate local `@electric-sql/pglite` test dependency. Run from the repository root. It creates an in-memory database, not a live database.

Month/day boundaries use Africa/Johannesburg. Trial usage conservatively includes all retained send reservations for the venue, not just this month. Failed and ambiguous sends still consume reservations. The daily25 pilot ceiling applies to every plan until a separately approved capacity change. Legacy internal IDs casual/premium map to public Growth/Pro. Unsupported legacy plans fail closed, not unlimited.

Actual local Billing screen checked using synthetic authenticated data: 24/25 available, then 25/25 and visible handoff stop. No owner login or actual provider request. Guard tests confirm no provider call when allowance refuses, conversation held for the team, and a linked number cannot silently be replaced or another connection started. The table's primary tenant key and unique account/profile keys continue to enforce one mapping.

Before live apply: verify prerequisite migration and strict table grants, exact new function absence, existing reserve function identity, current plan/status values, budget-row history and recovery route. Stop on mismatches; do not rewrite rows or subscription tiers. Apply only the new migration, never replay old migrations live. Then verify functions, privileges, usage boundaries and tenant access read-only. Keep all effects OFF; live provider acceptance and global account/token capacity remain separate gates.
