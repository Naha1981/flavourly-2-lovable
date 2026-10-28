# Roles and access rules

## Intended role matrix

This is the **required target matrix**, not a claim that every rule is already enforced in code.

| Action | Owner | Manager | Staff |
|---|---|---|---|
| View restaurant dashboard, inbox, menu, bookings and basic status | Yes | Yes | Yes |
| Draft a reply / respond to an assigned guest conversation | Yes | Yes | Yes |
| Send messages via controlled outbox after billing/quota/opt-out checks | Yes | Yes | Only the permitted staff workflow |
| Connect, disconnect, reset or pair the WhatsApp account | Yes | Yes | No |
| Change Revenue Employee mode or run a Revenue Employee action | Yes | Yes | No |
| Approve a Revenue Employee action or other approval request | Yes | Yes | No |
| Change billing plan, start checkout, cancel subscription | Yes | Yes | No |
| Manage staff membership and roles | Yes | Normally owner only | No |
| Access another restaurant's data | No | No | No |

## Implementation notes / known gap

The role is stored in `tenant_members.role` and accepts `owner`, `manager`, or `staff`. The server auth layer applies `authorizeTenant(tenantId, roles)`; `MANAGERS` means owner or manager, and `ANY_ROLE` means all three.

The audit identified manager-sensitive functions still guarded with any-role access: WhatsApp connect/pairing/disconnect/reset and Revenue Employee run/mode/approval/Gemini tool execution. Those changes may affect staff behaviour, so they remain blocked pending the owner's explicit decision and an updated acceptance test. **Do not treat this matrix as enforced until M1 is fixed and its role tests pass.**

## Adding/removing staff (proposed operator procedure)

Use only the supported staff-management screen if it is available in the deployed app and has been tested. Do not manually insert a `tenant_members` row in production without an approved operational procedure.

1. Confirm the person's identity and the correct restaurant.
2. Assign the least privilege needed: staff for daily operations, manager for operational controls, owner only for the business owner.
3. Ask them to sign in and confirm only their restaurant is visible.
4. Remove access immediately when a person leaves; revoke their session through Supabase Auth where possible.
5. Record the action and who approved it.

If the UI cannot add/remove members safely, stop and escalate rather than using an undocumented SQL edit.
