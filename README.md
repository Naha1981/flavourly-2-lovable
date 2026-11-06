# Flavourly

Your WhatsApp employee for restaurant follow-up.

Product page: https://flavourly.nahalabs.co.za/

## What this repository contains

- The workspace brings restaurant conversations, reply work, campaigns, approvals and reputation tasks together.
- The current repository contains account access, onboarding, billing, settings and restaurant-manager guides.

## Current limits

- A connected account is required for external messages. One own-number test does not prove every restaurant can connect.
- Payment, schedules and third-party delivery must be verified on the deployed account before they are promised to a customer. No guaranteed revenue or automatic recovery claim is made.

## Verification

Documentation checked 6 November 2026 against current source, available public pages and recorded test evidence. Source implementation and live acceptance are separate. No new customer data, message, payment or production change was created in this review.

Source references:
- `src/routes/dashboard.inbox.tsx`
- `src/routes/dashboard.approvals.tsx`
- `docs/handover/README.md`

## Maintaining this repository

See [MAINTAINER.md](MAINTAINER.md) for setup, checks and retained technical notes. Keep credentials in private environment settings, never in this README. Existing licence and copyright files remain unchanged.
