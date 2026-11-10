-- White-label branding configuration.
-- Apply only to a buyer-owned Supabase project after reviewing the setup guide.
-- Admin writes require a server-managed app_metadata.role = 'admin' claim.
create table if not exists public.app_branding (
  singleton boolean primary key default true check (singleton),
  brand_name text not null default '',
  tagline text not null default '',
  logo_url text not null default '',
  primary_color text not null default '#172033',
  accent_color text not null default '#64748b',
  footer_text text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_branding enable row level security;
grant select on public.app_branding to anon, authenticated;
grant insert, update, delete on public.app_branding to authenticated;

drop policy if exists "Public can read branding" on public.app_branding;
create policy "Public can read branding"
  on public.app_branding for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert branding" on public.app_branding;
create policy "Admins can insert branding"
  on public.app_branding for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update branding" on public.app_branding;
create policy "Admins can update branding"
  on public.app_branding for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete branding" on public.app_branding;
create policy "Admins can delete branding"
  on public.app_branding for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.app_branding (singleton)
values (true)
on conflict (singleton) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

drop policy if exists "Public can view brand assets" on storage.objects;
create policy "Public can view brand assets"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

drop policy if exists "Admins can upload brand assets" on storage.objects;
create policy "Admins can upload brand assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can update brand assets" on storage.objects;
create policy "Admins can update brand assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'brand-assets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'brand-assets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can delete brand assets" on storage.objects;
create policy "Admins can delete brand assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'brand-assets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
