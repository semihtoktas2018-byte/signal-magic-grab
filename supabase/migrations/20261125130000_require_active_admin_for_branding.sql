-- Ensure banned administrators cannot mutate white-label branding or brand assets.
-- RLS policies must check the current Auth user record, not only a possibly stale JWT role claim.

create or replace function public.is_active_deployment_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = (select auth.uid())
      and u.raw_app_meta_data ->> 'role' = 'admin'
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

revoke all on function public.is_active_deployment_admin() from public;
grant execute on function public.is_active_deployment_admin() to authenticated;

drop policy if exists "Admins can insert branding" on public.app_branding;
create policy "Admins can insert branding"
  on public.app_branding for insert
  to authenticated
  with check ((select public.is_active_deployment_admin()));

drop policy if exists "Admins can update branding" on public.app_branding;
create policy "Admins can update branding"
  on public.app_branding for update
  to authenticated
  using ((select public.is_active_deployment_admin()))
  with check ((select public.is_active_deployment_admin()));

drop policy if exists "Admins can delete branding" on public.app_branding;
create policy "Admins can delete branding"
  on public.app_branding for delete
  to authenticated
  using ((select public.is_active_deployment_admin()));

drop policy if exists "Admins can upload brand assets" on storage.objects;
create policy "Admins can upload brand assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (select public.is_active_deployment_admin())
  );

drop policy if exists "Admins can update brand assets" on storage.objects;
create policy "Admins can update brand assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'brand-assets'
    and (select public.is_active_deployment_admin())
  )
  with check (
    bucket_id = 'brand-assets'
    and (select public.is_active_deployment_admin())
  );

drop policy if exists "Admins can delete brand assets" on storage.objects;
create policy "Admins can delete brand assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'brand-assets'
    and (select public.is_active_deployment_admin())
  );
