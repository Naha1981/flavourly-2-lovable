# Flavourly Revenue Employee

## What shipped

Flavourly now has a provider-independent Revenue Employee layer built around:

Evidence -> Opportunity -> Approval -> Action -> Outcome

The current implementation is server-side and tenant-scoped.

## Core pieces

- `revenue_employee_config` controls disabled, shadow, approval_only and active modes.
- `intelligence_evidence` stores source, provider, evidence state, timestamp, URL and confidence.
- `revenue_opportunities` stores structured commercial opportunities.
- `revenue_opportunity_evidence` links every opportunity back to evidence.
- `revenue_actions` records approval, execution and external references.
- `revenue_agent_runs` records execution, tool-call and evidence counts.

## Provider boundary

Flavourly does not import browser, social, agent or video runtime internals.

The adapter contract is a small HTTP boundary:

POST <provider-base>/research

Payload:

{
  "task": "or "objective": "...",
  "tenantId": "...",
  "restaurantName": "...",
  "city": "..."
}

A provider can return either:

{
  "signals": [
    { "title": "...", "content": "...", "url": "...", "confidence": 0.7 }
  ]
}

or:

{
  "results": [
    { "title": "...", "text": "...", "url": "...", "confidence": 0.7 }
  ]
}

This allows the same Flavourly contract to sit in front of:

- NahaLLM
- Agent Reach
- Jev UltraFast
- Jev Social
- Demand Radar
- NahaLabs Content OS
- NahaLabs Video Engine
- OpenPost
- BrightBean
- Mixpost
- the shared NahaLabs WhatsApp Operator

## Current live product actions

The first production-safe Revenue Employee actions are deliberately conservative:

1. Analyse the restaurant's real menu, customer, reservation and reputation data.
2. Record evidence and deduplicate it.
3. Create revenue opportunities.
4. Put customer-facing campaign actions into an approval queue.
5. On approval, create a native Flavourly campaign draft.
6. No customer messages are sent by Revenue Employee approval itself. Sending still uses the existing Flavourly campaign/outbox controls.

## External evidence

External providers are optional. When a provider is not configured, the dashboard shows "adapter ready" instead of pretending the provider is live.

This is intentional. Provider credentials remain server-side and can be supplied later without rewriting Flavourly business logic.

## NahaLLM

When `NAHALLM_BASE_URL` and `NAHALLM_APP_KEY` are present, the Revenue Employee uses the NahaLLM OpenAI-compatible endpoint:

POST /v1/chat/completions

The model alias defaults to `balanced`.

Without NahaLLM, Flavourly falls back to deterministic business summaries.

## Browser and social execution

Jev, Jev Social, Agent Reach and Demand Radar remain execution/evidence providers. They do not become the restaurant system of record.

Keep:

- tenant authorization in Flavourly
- evidence state in Flavourly
- approvals in Flavourly
- campaign/outbox/consent in Flavourly
- customer and revenue state in Flavourly

## Safety boundary

New deployments default to `approval_only`.

Material customer-facing actions must not be sent directly by an LLM or external agent runtime.



CI verification branch: no application logic changes.
