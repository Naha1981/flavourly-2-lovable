# Flavourly: 50-Restaurant Readiness

Date: 2026-10-02

## Current migration position

The active `flavourly-2-lovable` repository is the Lovable/TanStack Start + Supabase implementation. It already contains the customer-facing storefront, inbox, booking/waitlist, loyalty, reputation, campaigns, menu intelligence and Gemini Live features.

The older `gemino-flavourly` repository is not fully migrated. It still contains backend engines and tests for daily revenue briefs, VIP/birthday/reactivation automation, customer segmentation, approval workflows, marketing attribution, competitor/market intelligence, PayFast billing/tier limits and additional WhatsApp contracts.

These missing areas should be migrated feature-by-feature rather than copying the old Next.js/Drizzle implementation wholesale.

## WhatsApp contract now used by Flavourly

Each restaurant is a tenant and has one Operator binding under `appId=flavourly + tenantId`.

1. Flavourly uses the platform Operator API key only from server code for bootstrap and tenant-credential provisioning.
2. The Operator tenant credential is stored server-side in `tenant_profiles.wa_operator_tenant_token`.
3. Runtime status, QR, reconnect, pairing-code and send calls use `X-NahaLabs-Tenant-Token`.
4. The tenant credential is never returned to the browser.
5. Bootstrap sends `PUBLIC_APP_URL/api/public/webhooks/whatsapp` to the Operator, so inbound forwarding has a real destination.
6. The dashboard displays the Operator QR image directly when the Operator returns a PNG data URL.
7. Inbound webhook parsing requires both `tenantId` and `waAccountId`.
8. Duplicate `wa_message_id` deliveries are ignored before conversation state is changed.
9. Production tenant authorization fails closed.

## 50-restaurant tenant boundaries

Every restaurant should have:

- one Flavourly workspace;
- one tenant membership set;
- one WhatsApp Operator binding;
- one `waAccountId`;
- one tenant credential stored server-side;
- tenant-scoped conversations and messages;
- tenant-scoped bookings, guests, loyalty, reputation, campaigns and intelligence.

The WhatsApp Operator remains the transport layer. Flavourly remains the restaurant intelligence and workflow layer.

## Go-live test for every restaurant

1. Create the restaurant workspace.
2. Persist the restaurant profile in Supabase.
3. Link its WhatsApp number.
4. Confirm the Operator reports the account as connected.
5. Send one inbound guest message.
6. Confirm the signed webhook is accepted under the correct tenant.
7. Confirm the inbox conversation and message belong to that tenant.
8. Confirm an enabled deterministic auto-reply goes back through the same Operator account.
9. Repeat the test with a second restaurant and verify no records cross tenants.

## Deployment variables

`PUBLIC_APP_URL`, `OPERATOR_URL`, `OPERATOR_API_KEY`, `WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` must be configured server-side. Production should keep `REQUIRE_AUTH=true`.

## Next migration tranche

The next highest-value legacy capabilities to port are approval gating, VIP/birthday/reactivation automation, deterministic marketing attribution, competitor/market intelligence, then PayFast/tier enforcement. Those should each land with Supabase schema, tenant isolation, server functions and tests before being exposed in the dashboard.