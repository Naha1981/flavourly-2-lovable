# Known Limits and Residual Risks

This list is deliberately candid and must be shared with the client.

1. **Messaging hardening is incomplete.** The Reply Drafter's current server function can pass any destination number directly to the operator and skips the controlled outbox path. It bypasses quota/billing, opt-out and inbox logging safeguards. Do not use it as a general outbound campaign feature until M3 is closed.
2. **Role enforcement is incomplete.** Some WhatsApp account control and Revenue Employee actions still use the any-role guard. Until M1 is closed, staff restrictions described in the roles matrix are not guaranteed.
3. **PayFast not verified against sandbox/live account.** Source now checks signature, trusted source header, amount/tenant references, PayFast postback and duplicate payment IDs. Automated tests pass on GitHub, but no captured sandbox ITN lifecycle or live R-small transaction/refund has been performed. Out-of-order ordering relies partly on a payment timestamp when present; test this with real PayFast fixtures.
4. **Migration reset not exercised.** The duplicate migration bodies were changed to no-ops while preserving their versions, but `supabase db reset` has not been run against an empty scratch project. Do not call Gate D complete yet.
5. **Generated DB types are stale and `db()` is untyped.** Query correctness is not fully compiler-checked until the supported type generator is run against the actual schema and the client code is upgraded without hand-editing generated files.
6. **Cron scheduling is external and unverified.** The five routes require a bearer secret. There is no evidence that the deployed scheduler has these jobs or that last-run state is displayed/alerted.
7. **No verified alert transport.** Health checks and error capture do not prove that the owner receives an email/WhatsApp alert. Each required alert must be triggered deliberately and evidenced.
8. **WhatsApp unofficial API risk.** The operator uses a Baileys-style WhatsApp integration, not an official WhatsApp Business Platform integration. WhatsApp may restrict or ban numbers; availability and reconnect behaviour depend on an external service and WhatsApp changes.
9. **GPS redemption is a soft control.** Claim redemption accepts coordinates submitted by the client; it is not hardware-backed location proof. Rate limiting of public claim endpoints also remains a security task.
10. **Backups/PITR are unknown.** The repository cannot show the live Supabase backup/PITR setting or demonstrate a successful restore.
11. **E2E package install is not yet reproducible in root CI.** Root typecheck/lint/unit tests/build pass on GitHub; browser-level acceptance is not covered by that run.
12. **Gemini model / provider limits need live verification.** Credentials, model availability, quotas, third-party URLs and provider health are environment-specific and were not validated against deployed accounts.
13. **External provider endpoints need SSRF review.** Revenue Employee allows environment-configured outbound URLs; review URL validation and network restrictions before allowing untrusted values.
14. **Owner monitoring is not automatic yet.** Until the alert wiring and alert-trigger tests are proven, someone must check operator, scheduler, payment and error status manually.
