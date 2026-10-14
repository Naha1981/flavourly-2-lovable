# WhatsApp architecture

Flavourly uses the shared **NahaLabs Central WhatsApp Operator**. There is
deliberately one WhatsApp engine, shared by NahaLabs applications.

```text
Flavourly (this app)
  │
  │ HTTPS + X-API-Key + X-App-Id ("flavourly") + X-Tenant-Id   (platform scope)
  │ HTTPS + X-NahaLabs-Tenant-Token                            (tenant scope)
  ▼
NahaLabs Central WhatsApp Operator (Render)
  │
  ├─ WhatsApp account lifecycle (bootstrap, connect, status, QR,
  │  pairing-code, reset, disconnect)
  ├─ Baileys sessions and Signal credentials
  ├─ Outbound send (/send)
  └─ HMAC-signed inbound webhooks
  │
  ▼
WhatsApp
```

## Responsibility boundary

**Flavourly** retains authentication, tenants, conversations/inbox, AI
auto-reply and reply drafts, approvals, billing/send limits, campaigns,
loyalty, bookings, quiet hours, and the outbound outbox
(`src/lib/outbox.server.ts`).

**The Operator** owns all WhatsApp transport and session state. Flavourly
never imports Baileys, creates a socket, generates a QR image itself, or
persists WhatsApp session credentials.

## Identity mapping

A tenant's operator account id is stored on `tenant_profiles.wa_account_id`.
Tenant-scoped calls use a per-tenant operator token stored on
`tenant_profiles.wa_operator_tenant_token`, issued via
`POST /accounts/tenant-token` and cached in `src/lib/whatsapp.server.ts`.
The browser never sees `OPERATOR_API_KEY` or tenant tokens; all operator
calls live in `*.server.ts` modules behind tenant authorization
(`authorizeTenant`).

## Pairing

QR: `POST /accounts/:id/connect`, then poll `GET /accounts/:id/qr` and
`GET /accounts/:id/status`. A QR or pairing code is never treated as a
successful connection - only `status.isConnected === true` is.

Phone pairing: `POST /accounts/:id/pairing-code`, then keep polling status.

## Inbound

The Operator signs message events with the shared `WEBHOOK_SECRET`.
`src/routes/api/public/webhooks/whatsapp.ts` verifies the HMAC over the raw
body with `timingSafeEqual` **before** parsing JSON, then
`src/lib/webhook-ingest.server.ts` de-duplicates on the WhatsApp message id,
upserts the conversation, classifies intent, and triggers auto-reply. Every
verified delivery is logged in `wa_webhook_events` so failures can be retried
from the WhatsApp health page.

## Cold starts

The Operator sleeps on Render's free tier. Unreachable hosts and gateway
statuses (502/503/504) are returned as `{ ok: false, waking: true }` so the
UI can show a "waking" state and retry instead of reporting a hard failure.

## Rule for future changes

Do not reintroduce a local WhatsApp server. Transport changes belong in the
shared operator service; business changes belong here.
`tests/whatsapp-contract.test.ts` enforces this boundary.
