# Changelog for KELTOŞ

All notable changes to KELTOŞ will be documented in this file.

This changelog uses the Keep a Changelog principles and Semantic Versioning.
Each entry is annotated with a confidence marker:
- ✅ Verified — present directly in the repository
- 🟡 Inferred — strongly implied by code or patterns in the repository
- ⚪ External infrastructure — outside the repository (infra, cloud, services)
- 🔵 Planned — roadmap or recommended process

Format
- Use sections: Unreleased and versions in reverse chronological order.
- For each release, list changes under these categories when appropriate: Added, Changed, Fixed, Security, Removed, Deprecated.
- Reference PR numbers and issue IDs where available.

---

## [Unreleased]
- Documentation: Add project foundation docs to `docs/project-foundation` branch. 🔵 Planned
- Reliability: CI and smoke test gating for releases (see ROADMAP and ENGINEERING_HANDBOOK). 🔵 Planned

---

## [0.1.0] - Initial baseline
Initial baseline captured from repository state (used as the first official baseline for KELTOŞ).

Summary of verified items in the baseline:
- Project scaffolding and tooling: package.json scripts (`dev`, `build`, `lint`, `format`) and Vite build. ✅ Verified (package.json, vite.config.ts)
- SSR entry: `src/server.ts` implements SSR delegation and catastrophic error normalization using `renderErrorPage()`. ✅ Verified (src/server.ts)
- Start instance and middleware: `src/start.ts` registers global middleware including `attachSupabaseAuth` and error handling middleware. ✅ Verified (src/start.ts)
- Routing: Generated TanStack Router file `src/routeTree.gen.ts` listing routes:
  - `/` (Index)
  - `/exchange`
  - `/performance`
  - `/whale`
  - `/api/public/hooks/kpk-signals-cron` ✅ Verified (src/routeTree.gen.ts)
- Supabase integration: client and server clients and types:
  - `src/integrations/supabase/client.ts` (client wrapper) ✅ Verified
  - `src/integrations/supabase/client.server.ts` (server admin client, requires SUPABASE_SERVICE_ROLE_KEY) ✅ Verified
  - `src/integrations/supabase/auth-attacher.ts` (function middleware attaches session token) ✅ Verified
  - `src/integrations/supabase/auth-middleware.ts` ✅ Verified
  - `src/integrations/supabase/types.ts` (DB type definitions for tables: `kpk_signals`, `whale_events`, `exchange_prices`, `feedback_submissions`) ✅ Verified
- UI and styling: Tailwind + Radix UI and CSS entry `src/styles.css`. ✅ Verified
- Linting and formatting configs: `.prettierrc`, `.prettierignore`, `eslint.config.js`. ✅ Verified

Notes and inferred observations:
- The presence of a public cron/webhook route (`/api/public/hooks/kpk-signals-cron`) suggests a signal ingestion entrypoint; whether it's production-exposed is not determinable from the code alone. 🟡 Inferred
- No explicit Telegram adapter is present in repository files (not verified nor provably absent from external infra). Use the confidence legend before stating presence/absence in future changes. 🟡 Inferred

---

## How to use this changelog
- For each PR that will be included in a release, add a brief changelog entry under Unreleased following the categories.
- Before tagging a release, move entries from Unreleased into a new version heading and add the release date.
- Use Conventional Commits in PRs to make changelog generation easier (see ENGINEERING_HANDBOOK). ✅ Verified (handbook guidance)

Release example

### Example: Patch release (0.1.1)
- Title: 0.1.1 — Patch: fix SSR crash on malformed route
- Changelog snippet to add under Unreleased before release:
  - Fixed: Normalize H3-swallowed SSR HTTPError to render human-friendly error page; log original error to error capture. ✅ Verified (src/server.ts handles normalization)
- After verification and release, the changelog entry becomes:

## [0.1.1] - 2026-08-07
### Fixed
- Normalize SSR HTTPError swallowed by underlying library and render friendly error page (see src/server.ts). ✅ Verified

### Security example entry
- If a security fix touches secrets or service-role usage, include:
  - Security: Rotate SUPABASE_SERVICE_ROLE_KEY and update deployment secret store. 🔵 Planned

---

## Release and tagging guidance
- Follow Semantic Versioning.
- Tag the release with `vMAJOR.MINOR.PATCH` and use the release notes from this changelog as the GitHub Release body. 🔵 Planned
- For patches: create `hotfix/<desc>` branch off `main`, run canary, then merge and tag. ✅/🔵 (process partly verified in handbook)

---

## Template for changelog entries (copy into PR body)
- Category (Added, Changed, Fixed, Removed, Deprecated, Security)
- Short descriptive title
- Files touched / modules impacted (include paths)
- Confidence marker (✅/🟡/⚪/🔵)
- PR link or issue reference

Example PR changelog snippet:
- Fixed: Prevent duplicated kpk_signals created on webhook retry (idempotency via dedupe key)
  - Files: `src/routes/api/...`, `src/integrations/supabase/client.server.ts`
  - Confidence: 🟡 Inferred (requires test coverage)
  - PR: #123

---

## Appendix: Changelog best practices for KELTOŞ
- Every public release must have an entry in this changelog.
- Be explicit about confidence levels when describing changes that touch operational or infra boundaries.
- Keep changelog entries consumer-focused — explain user-visible impact first, then technical context.
- For security fixes, redact details that reveal exploit vectors; include remediation steps and whether disclosure is coordinated.

(End of CHANGELOG.md)
