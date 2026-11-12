# Flavourly — Restaurant Manager Guide

This guide is written for daily use. The exact menu labels may differ by deployed version; use only controls visible in your account. A status not visible in the dashboard is not a successful health check.

## 1. Sign in and select the right restaurant

Open the client URL and sign in with your own account. Confirm the restaurant name before editing anything. Never share passwords or one-time codes. If a different restaurant appears, stop and contact support immediately.

## 2. Check WhatsApp before a busy service

Open the WhatsApp/Health area. Look for Connected status, a recent delivery timestamp and any failed webhook/send count. If disconnected, use the QR or pairing-code flow shown in the app from the restaurant's own phone. Never send a QR or pairing code to support. If the operator itself appears unreachable, stop repeated reconnect attempts and report the time shown.

## 3. Work from the inbox

Open Inbox and choose the guest conversation. Read the guest message and context before replying. Do not promise availability, prices, refunds, or menu items that have not been confirmed. Use the reply drafter as a draft and review it before sending. Until the message-send hardening is completed, avoid direct arbitrary-number sends; use only the currently approved, conversation-based workflow.

## 4. Manage bookings and reminders

Review booking requests and confirm the date, time, and party size before considering a booking final. Check the reservation appears in the bookings list. Reminders depend on the external scheduler running; do not promise a reminder was sent unless the app shows a send/delivery record.

## 5. Keep the menu accurate

When an item is unavailable, toggle it unavailable in Menu and save. Re-open the item/list to verify the state persisted. Tell staff that unavailable items should no longer be offered. If an AI reply offers the item after the toggle, correct the guest manually and report the example with guest details removed.

## 6. Handle complaints and recovery vouchers

Log the incident, follow the restaurant's recovery policy, and request a manager's approval where shown. Never promise a refund or discount outside the restaurant's agreed policy. For a voucher, check validity and redemption status before honouring it. GPS claims use client-supplied location as a soft control; they are not proof of a guest's physical location.

## 7. Loyalty

Record a visit only once and use a unique receipt/bill reference where requested. Check the points balance and transaction history after the visit. For a reward claim, use the generated guest link and verify the claim has redeemed before issuing the benefit. The database has an idempotency control, but staff should not repeatedly click or retry if the result is uncertain.

## 8. Campaigns

Before creating a campaign, confirm segment, timing, message and intended audience with the manager. Review opt-outs and quiet-hour behaviour. Preview the content and use the app's approval step if displayed. Do not duplicate a campaign because the UI appears slow; check its status first.

## 9. Billing

Review plan and billing state in the billing area. A return to PayFast's success page does not itself prove payment. Use the status shown in Flavourly after PayFast sends and the app validates the notification. If status is pending/past due or the payment seems wrong, stop and contact the account owner; never attempt to edit billing state directly.

## 10. When to contact support

Include restaurant name/slug, approximate time (SAST), what action you took, the error text with secrets/guest details removed, and a screenshot with phone numbers/message contents hidden. Do not send passwords, payment-card information, merchant credentials, QR codes, pairing codes, API keys or guest message bodies.

## Client sign-off

Run the [click-by-click Acceptance Script](ACCEPTANCE_SCRIPT.md) in the staging environment and record pass/fail per step before this guide is approved for the restaurant. Use only test guest accounts/numbers and sandbox billing until the owner authorises production testing.
