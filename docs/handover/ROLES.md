# Roles and permissions

Three roles per restaurant. The first person to create a restaurant is its **owner**. Roles live in `tenant_members`.

| Area | Owner | Manager | Staff |
|---|:--:|:--:|:--:|
| See inbox, read and reply to guest messages | ✅ | ✅ | ✅ |
| Use AI reply drafting and message triage | ✅ | ✅ | ✅ |
| Mark a menu item available / unavailable | ✅ | ✅ | ✅ |
| Redeem a guest's voucher at the till | ✅ | ✅ | ✅ |
| View menu, venue settings, revenue-agent dashboard, voice assistant | ✅ | ✅ | ✅ |
| Edit menu, categories, pairings, venue settings | ✅ | ✅ | ❌ |
| Create and send campaigns | ✅ | ✅ | ❌ |
| Approve or reject held AI messages | ✅ | ✅ | ❌ |
| Social drafts, reputation recovery, market intelligence | ✅ | ✅ | ❌ |
| Connect, re-pair, disconnect or reset the restaurant's WhatsApp number | ✅ | ✅ | ❌ |
| Run the revenue agent, change its mode, approve its actions | ✅ | ✅ | ❌ |
| Billing: subscribe, change plan, cancel | ✅ | ✅ | ❌ |

This table is enforced in code and pinned by `tests/role-matrix.test.ts`. Changing a permission means changing both.

Manual replies from the dashboard only go to guests who have already written to the restaurant on WhatsApp.

## Adding or removing team members (no screen for this yet)

There is currently no page in the app for managing staff. Until one is built, the owner of the *platform* (not the restaurant) does it in the Supabase SQL editor. The person must first sign up in the app with their email.

```sql
-- add (role: 'owner' | 'manager' | 'staff')
insert into public.tenant_members (tenant_id, user_id, role)
select 'RESTAURANT-SLUG', id, 'staff' from auth.users where email = 'person@example.com'
on conflict (tenant_id, user_id) do update set role = excluded.role;

-- remove
delete from public.tenant_members
where tenant_id = 'RESTAURANT-SLUG'
  and user_id = (select id from auth.users where email = 'person@example.com');
```
Agree with the client who may ask for this and how fast you respond (see the support terms in `OWNER_CHECKLIST.md`). A team-management page is listed in `LATER.md`.
