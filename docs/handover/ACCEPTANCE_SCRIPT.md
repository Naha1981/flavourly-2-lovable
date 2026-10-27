# Acceptance script (about an hour)

Run in a **staging** deployment with the PayFast **sandbox** and a **test WhatsApp number**, with a second test phone as the "guest". Tick each box only if the expected result happened. Record date and who ran it at the bottom.

| # | Do this | Expected |
|---|---|---|
| 0 | Open `/api/public/health` | `status: ok`, every check ok |
| 1 | Sign up a new restaurant, finish onboarding. Open *WhatsApp health* and connect the test number with the QR or pairing code | Status shows connected |
| 2 | From the guest phone send "Hi, can I book a table for 4 tomorrow at 7pm?" | AI replies in the guest phone; the conversation and both messages appear in *Inbox*; a booking/lead is recorded |
| 3 | Check the booking reminder | A reminder is sent at the scheduled time (the reminders job must be running) |
| 4 | Guest sends a complaint ("the food was cold") | A reputation incident appears; a recovery message with a voucher is drafted and waits in *Approvals* (not sent yet) |
| 5 | Approve it | The guest receives it; the voucher code is valid |
| 6 | *Redeem*: enter the code, confirm. Enter it again | First time succeeds; second time is refused |
| 7 | **Billing (sandbox):** subscribe to Starter with a PayFast sandbox buyer | Returns to the app; plan becomes **active** within a minute. Then cancel in the app: PayFast shows the subscription cancelled and the app shows cancelled |
| 8 | Expire the trial of a second test restaurant (set `trial_ends_at` in the past) | Sends are paused with a clear message; the inbox still readable |
| 9 | Guest replies STOP. Create and send a campaign to all guests | The STOP guest does not receive it |
| 10 | Loyalty: record a visit, claim points via the geo-claim link, try the link twice | Points awarded once; second claim refused |
| 11 | *Menu*: mark an item unavailable, ask the AI for it from the guest phone | The AI says it is unavailable |
| 12 | Log in as a **staff** user. Try to open *Billing*, *Campaigns*, *Approvals*, and to disconnect WhatsApp | All refused (the "forbidden" message) |
| 13 | Log in as a user of **another restaurant**. Try to open the first restaurant's pages / data | Refused |
| 14 | Disconnect the test number (phone: remove the linked device). Wait for the watchdog (5 minutes) | You receive an alert; the dashboard shows disconnected |
| 15 | Stop the outbox job (or pause the scheduler) for 15 minutes with a queued message | Health goes `down` and you receive the "outbox:overdue" alert; after restarting, the message sends |
| 16 | On a mid-range Android phone on mobile data open the dashboard and complete steps 2 and 6 | Usable and not painfully slow |

Signed off by ______________ on ____/____/______. Failed steps and notes:
