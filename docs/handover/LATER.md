# Later: deferred work (not part of handover)

Add new ideas here instead of building them during hardening.

**Product**
- Team-management page (invite, change role, remove staff)
- Official WhatsApp Business API option for clients who need guaranteed delivery
- Self-service data export / delete a guest (POPIA requests) from the dashboard
- Paginated/parallel revenue-agent runs beyond 100 restaurants

**Engineering**
- Upgrade zod 3 to 4 and remove the remaining audit advisory
- Regenerate Supabase types and replace the untyped `db()` helper
- Rate limit the public claim endpoints
- Prompt-injection review and adversarial tests for the AI reply and triage prompts
- Move from Nitro beta to a stable release
- Load test the outbox at the largest client's volume
- End-to-end browser tests run in CI against a preview deployment
