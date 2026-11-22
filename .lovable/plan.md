# Preview DNS error: diagnosis and minimal fix

## Evidence (read-only checks, 22 Nov 2026)
- Committed `.env` (commit 42110ba): all SUPABASE_* / VITE_SUPABASE_* values point to `gmwlkkebwpenocatlmty`.
- The preview dev server process has its own environment, injected by the platform from the project's Lovable Cloud link: `VITE_SUPABASE_URL`, `SUPABASE_URL`, `*_PROJECT_ID` (and `EXPO_PUBLIC_*`) = `hnzjvcwbcfgfwpnfyhiz`.
- `hnzjvcwbcfgfwpnfyhiz.supabase.co` has no DNS record (lookup fails, HTTP 000): that backend is paused/inactive.
- Git history: platform "Work in progress" commits 12d0e09 and 3f2f1ba rewrote `.env` to `hnzjv`; both were reverted manually.

## Cause
Vite gives already-set process environment variables priority over values in `.env`. The preview server is started with platform-injected `hnzjv` values, so the preview bundle uses `hnzjv` no matter what `.env` says. The published build was produced from the committed `.env` (gmwlk), so it works. The project's Cloud link still points at the old, paused `hnzjv` instance, and that same link is what keeps rewriting `.env`.

## Safest minimal fix (no code changes)
1. Do not edit code or `.env`, and do not resume `hnzjv` (it would bring back outdated data and accounts).
2. Have the project's backend connection repointed to `gmwlkkebwpenocatlmty`. This is a platform/project-settings change that the agent cannot make. Once it's done, the preview environment and `.env` regeneration will both use gmwlk.
3. After that, verify: preview /login loads, Google sign-in works, `.env` still shows gmwlk, then publish.

Interim workaround (not recommended long term): none safe in code. Hardcoding the URL would bypass env config.
