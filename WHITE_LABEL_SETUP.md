# White-label setup

This guide applies to a buyer-owned Supabase project. Do not run the migration against the seller's live project as part of source-code preparation.

## 1. Apply the branding migration

Apply `supabase/migrations/20261110120000_add_white_label_branding.sql` to the buyer's Supabase project after checking the target project and taking a backup.

The migration creates:
- `public.app_branding`: one deployment-wide branding record.
- `brand-assets`: a public-read storage bucket for logos.
- Row-level security policies that allow public reads but restrict writes to authenticated users whose server-managed JWT claim is `app_metadata.role = 'admin'`.

## 2. Grant the deployment owner access

First create or identify the owner's Auth user and copy its UUID from Supabase Authentication > Users.

In the buyer's Supabase SQL Editor, set the role in `auth.users.raw_app_meta_data` for that exact UUID:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = 'REPLACE_WITH_OWNER_AUTH_USER_UUID';
```

Replace the UUID before running. Verify that exactly one intended user was updated. Sign out and sign in again so the refreshed access token contains the new server-managed claim.

Do not put the role in `user_metadata`: users can generally edit their own user metadata. Never expose the Supabase service-role key in browser code.

## 3. Storage notes

The bucket accepts PNG, JPEG, WebP and SVG files up to 2 MiB. Public read is intentional so the logo can appear before login. Only the admin claim can upload, update or delete objects in this bucket. Use trusted SVG files only; if SVG uploads are not needed, remove `image/svg+xml` from the bucket allowlist.

## 4. Isolation and deployment

Each buyer must use their own Supabase project and apply the migration there. The branding row is deployment-wide, not per end-user. Do not share a Supabase project between unrelated buyers if they require independent branding.

This migration file does not apply itself to any remote project. No production database or storage bucket is changed by adding this file to the repository.
