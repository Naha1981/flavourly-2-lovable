# Client Acceptance Script

**Purpose:** owner + restaurant manager validate real workflows on the deployed staging environment in under one hour. Run on staging only, with test guest contacts, a dedicated test WhatsApp account, and PayFast sandbox. Never deliberately disconnect a live restaurant number or send a test campaign to real guests.

## Before starting (owner, 5 minutes)

- [ ] Confirm staging URL, commit/deploy ID, and working owner + staff logins.
- [ ] Prepare test Restaurant A and separate test Restaurant B, if possible; do not use customer data.
- [ ] Prepare one dedicated WhatsApp test number that can be linked with QR or pairing code.
- [ ] Confirm the WhatsApp operator and webhook endpoint are reachable.
- [ ] Confirm cron jobs are configured in staging and their last run is visible to the owner.
- [ ] Confirm PayFast is in sandbox with test merchant credentials/passphrase and a test subscription; check the runbook before retrying ITNs.
- [ ] Make sure logs/screenshots contain no passwords, keys, QR/pairing codes, guest phone numbers or message contents.

Record the tester, date/time (SAST), staging URL, commit SHA, and test restaurant slug here: _________________________________

## Test 1 — Sign up, onboard, and connect WhatsApp (5 minutes)

1. Open staging in a private/incognito window.
2. Choose **Sign up** and create a dedicated test owner account.
3. Complete the restaurant profile with a clearly marked test name and non-production contact information.
4. Open the WhatsApp setup screen.
5. Select **QR code**; scan using the dedicated test WhatsApp number. Disconnect that test session and repeat using **pairing code** if the UI supports it.
6. Return to the app and refresh WhatsApp status.

**Expected:** the owner lands in the correct test restaurant; QR/pairing completes without exposing credentials in logs; dashboard status changes to Connected and stays connected after refresh. If either method is not offered, mark that sub-step **Fail / not supported** and attach a screenshot with the QR and phone details hidden.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Test 2 — Guest booking request and reminder (5 minutes)

1. From the dedicated test guest phone, send a WhatsApp message asking to book a table for a future test date/time and party size.
2. Open the Flavourly Inbox and select that conversation.
3. Check the AI reply; verify it does not claim an unconfirmed table is already reserved.
4. Complete/confirm the booking through the supported app workflow.
5. Open the Bookings/Reservations view and locate the reservation.
6. For reminder verification, use a booking whose reminder window is due in staging, or trigger the protected reminders cron once using the staging scheduler (not by pasting the secret into a terminal history).
7. Check the outbox/inbox state for the reminder delivery.

**Expected:** request is saved under Restaurant A, a truthful reply is sent/approved according to configuration, the booking appears once, and the reminder has a visible sent/delivery record. Merely seeing an HTTP 200 from cron does not prove a message was delivered.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Test 3 — Complaint, incident, recovery voucher, redemption (6 minutes)

1. Send a test guest complaint from the test WhatsApp account.
2. Open Inbox and verify the conversation is attributed to Restaurant A.
3. Open the reputation/incidents area and create or locate the corresponding incident.
4. As a manager, draft a recovery voucher under the test restaurant's policy.
5. Approve it if the app requires approval, then send it through the supported controlled workflow.
6. Open the claim/redeem page as the test guest and redeem it once.
7. Refresh the claim and ledger/incident details.

**Expected:** one incident and one voucher; status and audit trail update; second redemption of the same claim is rejected and points/benefit are not issued twice. Do not use an actual financial refund in this test.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Test 4 — Loyalty, GPS claim, points and one-time burn (5 minutes)

1. Record a test visit with a unique test bill/receipt reference.
2. Check the customer's visit count and points balance.
3. Repeat the same bill reference once to simulate a retry.
4. Open a reward claim and use the allowed staging location/test coordinates.
5. Redeem the same claim twice and inspect the ledger.

**Expected:** first visit awards points; repeated bill reference awards zero additional points; the reward burns points at most once. The GPS check is a soft control and this test is not proof of physical location.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Test 5 — Menu unavailable toggle (3 minutes)

1. Open **Menu**.
2. Select a low-risk test item and change it to **Unavailable** / sold out.
3. Save, navigate away, and reopen the menu.
4. Ask the test WhatsApp account a question that would normally offer that item.

**Expected:** unavailable state persists and the AI does not offer the sold-out item as available. If it does, correct the guest manually and mark Fail.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Test 6 — Campaign, opt-out and quiet hours (6 minutes)

1. Use only the test guest number. Confirm it is opted in to receive test marketing.
2. Create a campaign with a harmless test message and a one-recipient test segment.
3. Preview and approve the campaign if prompted; verify the queued job and delivery log.
4. Send **STOP** from the test guest phone; verify the opt-out record.
5. Attempt one further automated campaign/lifecycle send to that guest.
6. Test a scheduled automated message during quiet hours using a staging-only schedule/test clock. Do not change the production clock.
7. Send **START** from the test guest phone only if the acceptance plan requires testing re-opt-in, then verify the opt-out record is removed.

**Expected:** the initial test campaign is logged; STOP blocks automated sends until START; quiet-hour delivery is delayed; manual/transactional replies follow the restaurant's approved policy. No broadcast to a real guest list is allowed.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Test 7 — Billing and feature gates (6 minutes)

1. Open **Billing** as the test owner and begin a PayFast sandbox subscription for the intended test tier.
2. Complete sandbox checkout and return to Flavourly.
3. Confirm the webhook received a valid signature, PayFast postback returned VALID, a transaction ID was recorded once, and the tenant status becomes active.
4. Send a duplicate sandbox ITN if supported by the test harness; verify status does not change twice.
5. Cancel the sandbox subscription and verify status becomes canceled.
6. Use a separate staging tenant/test fixture to verify a failed payment becomes past_due, and an expired trial cannot enqueue messages.
7. Confirm gated messaging/paid features stop when service is not allowed.

**Expected:** billing state is driven by validated server notifications, duplicate notification is a no-op, cancel and failed payment reach the expected state, and disabled billing blocks outgoing messages. Do not complete a real live payment during this script. If the failed-payment/trial-expiry scenario cannot be simulated safely, mark it Fail / owner test needed, not Pass.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Test 8 — Role and tenant isolation (6 minutes)

1. Invite/create a staff user for Restaurant A and a separate user for Restaurant B using the supported user management workflow.
2. Sign in as staff for Restaurant A. Try to open a manager-only operation (WhatsApp reset/disconnect, Revenue Employee mode, approval, billing).
3. Try to open Restaurant B's tenant data by using its direct URL or a test request; do not modify or delete anything.
4. Repeat the read test with a user from Restaurant B attempting to open Restaurant A.

**Expected:** permitted staff actions work, manager-only actions return a clear denied response, and each user sees only their own restaurant. If any cross-tenant data appears or an unapproved operation succeeds, stop immediately and mark Fail / security incident. Note: the current manager-only guards are a known open audit item, so do not assume this test will pass.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Test 9 — Operator disconnect and owner alert (4 minutes)

1. Use a disposable staging WhatsApp account only.
2. Disconnect that account using the supported test workflow or simulate an operator outage in staging.
3. Confirm the dashboard changes to Disconnected/Unavailable and includes a recent status/error.
4. Confirm the configured owner alert is received and contains tenant, route/request ID or timestamp but no guest message body, phone number or token.
5. Reconnect the test number and verify status recovers.

**Expected:** dashboard status reflects the outage and the owner receives a real alert. A message written to logs is not evidence an email/WhatsApp alert was delivered. If alerting is not configured, mark Fail / not implemented.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Test 10 — Mid-range Android + slow connection (5 minutes)

1. Open the staging URL on a physical mid-range Android phone (record device/OS and browser).
2. Use browser DevTools/network shaping or a controlled slow connection profile where possible.
3. Sign in and navigate to Dashboard, Inbox, Menu, Bookings and Billing.
4. Send and receive a harmless message using the test WhatsApp account.
5. Refresh the app and check for stuck loaders, console errors or duplicate actions.

**Expected:** core screens remain usable, loading/error state is understandable, controls can be tapped without overlap, and retries do not duplicate messages/payments. Capture screen recordings with guest details redacted.

Result: Pass / Fail    Evidence link: __________________    Notes: __________________

## Sign-off

- [ ] All ten tests passed, including each applicable sub-step.
- [ ] All failures have an issue, owner, severity and workaround.
- [ ] No test used a real guest list, live payment or production WhatsApp number.
- [ ] Owner and client agree that the tested commit/deploy is the version being accepted.

Owner name/signature: __________________  Date: __________

Client manager name/signature: __________________  Date: __________

Accepted commit/deploy ID: __________________
