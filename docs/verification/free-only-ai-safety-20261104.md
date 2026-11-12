# Free-only AI safety patch, 4 November 2026

Unpushed proposal against bb59518, not a live fix.

Message analysis and guest-preference extraction are disabled at their server implementations. Their paid gateway code, API key reads and provider SDK calls are removed, not hidden behind an environment toggle. An old configured key or an enabled WhatsApp AI flag cannot activate them. Triage now requires a tenant ID and checks membership. Preference extraction retains its membership guard, and saving manually reviewed preferences is unchanged.

The existing free Groq WhatsApp draft/reply path, switches and limits are unchanged. No schema, production setting, credential, signup policy, checkout, worker throughput or public menu change is included.

The enforced paid-call allowance for these two paths is zero. This patch does not claim to add a platform-wide budget for every AI provider. Future activation requires separate owner spending authority plus atomic tenant/global caps, bounded output/timeout and review at every provider boundary. No paid provider can be enabled by this patch.

Tests use fake inputs and no live provider: source wiring plus existing real guard tests for no-login/nonmember denial; member gets an honest paused result; stale keys and enabled old flags make zero fetch calls; concurrent repeated direct calls return paused; source checks prevent accidental SDK/key/toggle reintroduction; preference saving and authorization wiring remain. Existing tenant-auth tests exercise the real membership guard.

Independent auditor gate remains required before seeking approval to push. This document records preparation only, not an auditor pass or live acceptance.
