-- Break the privileged-MFA bootstrap deadlock without weakening privileged writes.
-- A signed-in user may read only their own role row at AAL1 so the client can
-- recognise privileged users and route them into AdminMfaGate enrollment.
-- All role mutations and all other protected tables still require AAL2.
drop policy if exists "Privileged sessions require MFA" on public.user_roles;

create policy "Privileged MFA required for role reads except own bootstrap row"
on public.user_roles
as restrictive
for select
to authenticated
using (
  not private.is_privileged_role((select auth.uid()))
  or ((select auth.jwt()) ->> 'aal') = 'aal2'
  or user_id = (select auth.uid())
);

create policy "Privileged sessions require MFA for role inserts"
on public.user_roles
as restrictive
for insert
to authenticated
with check (
  not private.is_privileged_role((select auth.uid()))
  or ((select auth.jwt()) ->> 'aal') = 'aal2'
);

create policy "Privileged sessions require MFA for role updates"
on public.user_roles
as restrictive
for update
to authenticated
using (
  not private.is_privileged_role((select auth.uid()))
  or ((select auth.jwt()) ->> 'aal') = 'aal2'
)
with check (
  not private.is_privileged_role((select auth.uid()))
  or ((select auth.jwt()) ->> 'aal') = 'aal2'
);

create policy "Privileged sessions require MFA for role deletes"
on public.user_roles
as restrictive
for delete
to authenticated
using (
  not private.is_privileged_role((select auth.uid()))
  or ((select auth.jwt()) ->> 'aal') = 'aal2'
);
