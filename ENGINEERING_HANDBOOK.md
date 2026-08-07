# KELTOŞ Engineering Handbook

Version: 1.0.0 — KELTOŞ production baseline

This handbook is the authoritative reference for engineers building and operating KELTOŞ (internal product name). It describes our engineering philosophy, operational rules, release and patch processes, testing and rollback strategies, coding standards, and rules for developing AI features.

This document is specific to the code in the repository `signal-magic-grab` and assumes the existing implementation (TanStack React Start front-end, SSR entry in `src/server.ts`, TanStack Router generated routes, and Supabase as primary backend).

---

## Engineering philosophy for KELTOŞ

KELTOŞ is a commercial SaaS that ingests, normalizes and distributes time-sensitive market signals. Our engineering philosophy reflects that our customers depend on correctness and timeliness; therefore operational stability, data integrity, and traceability are non-negotiable.

Core principles
- Stability-first: Prevent incorrect signals and delays. Deprioritize non-essential features that increase risk to production.
- Correctness & idempotency: Signal ingestion and downstream processing must be idempotent and deterministic.
- Observability & telemetry: Every critical path emits structured telemetry and diagnostic context.
- Least privilege: Privileged credentials and operations must be restricted to server-only code paths.
- Small blast radius: Changes should be incremental, reversible and covered by tests.

Why stability is prioritized over new features
- Customers act on KELTOŞ signals; any incorrect or delayed signal can cause direct financial harm and immediate churn.
- Stable infrastructure reduces support costs and enables reproducible growth and monetization.
- Trust is the product's primary asset; feature growth comes after reliable, measurable delivery.

---

## Protected systems and modules

The following systems form the critical surface area of KELTOŞ. Changes to these components require a Code Owner review, a written runbook attached to the PR, and passing integration tests in staging.

- Signal Engine
  - Any code handling signal ingestion, deduplication, normalization and scoring. In repo: handlers under `src/routes/api/public/hooks/kpk-signals-cron` and any server-only processing modules.
- Cron and Scheduler
  - Any endpoint or scheduled task responsible for pulling or receiving external signal payloads.
- Telegram Notification Adapter
  - Delivery adapters, credential handling, throttling and retry logic for Telegram-based notifications.
- Whale Radar
  - Components under `src/routes/whale` and supporting server-side event processing for big trades detection.
- Performance Engine
  - Backend routines and client visualizations that calculate performance metrics (`/performance`).

Change gating for protected systems
- A PR touching these systems must include:
  - Design summary and risk assessment in the PR description.
  - Automated tests: unit + integration or contract tests that cover the change.
  - Rollback/runbook section explaining how to revert the change and how to mitigate data issues.
  - Staged rollout plan (canary, percentage rollout) where applicable.

---

## Release rules

Release types
- Patch: fix regressions, security or reliability issues. Increment patch version.
- Minor: non-breaking improvements and small feature additions. Increment minor version.
- Major: breaking changes requiring coordinated migrations.

Release process
1. Create a release branch `release/x.y.z` from `main`.
2. Update `CHANGELOG.md` under Unreleased with high-level notes.
3. Run CI: lint → build → unit tests → integration tests → smoke tests.
4. Obtain approvals (Code Owner for protected modules if touched).
5. Tag the release with semver and create a GitHub Release containing the changelog and runbook.
6. Deploy to staging/canary, run canary checklist, promote when green.

Required release artifacts
- CHANGELOG entry
- Rollback/runbook
- Smoke test checklist
- Security review for any change touching secrets or credentials

---

## Patch rules

When to patch
- Production incidents, critical security vulnerability, customer-impacting bugs.
- Patches must be minimal and focused to reduce risk.

Patch workflow
1. Branch `hotfix/<short-desc>` from `main`.
2. Minimum change to fix the issue + test(s) reproducing the bug where possible.
3. Run CI and deploy to canary.
4. After verification, tag and release as a patch.
5. Backport as needed to `main` if `main` has moved past deployed production.

Emergency patches
- If an immediate rollback is required, follow the rollback strategy. Emergency patches should still follow the above flow but prioritize speed while still recording the runbook.

---

## Testing rules

Testing tiers
- Unit tests: fast, deterministic; cover logic in `src/lib` and `src/integrations`.
- Integration tests: server-side interactions with Supabase (use a test project or local Postgres), route handlers, middleware.
- E2E/Smoke tests: staged environment tests covering authentication, signal webhook path, and key dashboards.

Mandatory testing for PRs
- Any change touching protected systems must include unit tests and at least one integration test.
- All PRs must pass lint and formatting checks.

Test environments and data
- Use isolated staging and test Supabase projects; never run tests against production data.
- Keep seed data small and deterministic for CI.

Test coverage targets
- Business-critical modules: >= 80%
- Non-critical UI components: pragmatic coverage based on risk.

---

## Rollback strategy

Principles
- Prefer revert-deploy over code surgery.
- Keep database migrations backwards-compatible or apply in staged phases with feature flags.

Rollback steps
1. If the release causes critical failures, revert to the last tagged release and redeploy.
2. If rollback is due to data corruption, run the data recovery playbook: restore from the latest backup snapshot or run compensating transactions using `supabaseAdmin`.
3. Postmortem and follow-up fix: create a ticket with timeline and mitigations.

DB migration rules
- Prefer additive migrations. For destructive changes, use the multi-step approach: add columns → backfill → switch reads → remove old columns.

---

## Coding standards

Language and tooling
- TypeScript with strict typing where practical.
- Prettier and ESLint enforced in CI (`npm run lint`, `npm run format`).

File-level boundaries
- `.server.ts` suffix for server-only modules. Client bundles cannot import server-only modules.
- `src/integrations/supabase/*` contains the canonical supabase clients and types; keep service-role uses in `.server.ts` files only.

Patterns
- Prefer pure functions for business logic and isolate side effects behind small wrappers.
- All async operations must handle transient errors and be retry-safe.
- Use dependency injection for external clients where helpful to enable testing.

Commits and PRs
- Use Conventional Commits. PR descriptions must include context, test plan, and rollback instructions for protected systems.

---

## AI development rules

Context
- KELTOŞ may leverage ML/AI for ranking, signal classification or enrichment. AI outputs influence decisions and therefore demand special governance.

Governance rules
1. Human-in-the-loop: All AI-driven decisions must be human-reviewed during the first production trials.
2. Shadow mode: New models run in shadow against live traffic but do not affect user-facing decisions until validated.
3. Versioning: Record model versions, weights, and prompt templates. Keep them immutable for a given experimental run.
4. Data hygiene: Do not include PII or secrets in training data unless legally cleared.
5. Monitoring: Track model performance metrics and drift; define SLA-equivalent thresholds for retraining or rollback.
6. Explainability: Store rationale metadata with each AI decision for auditing.

Deployment path for AI features
- Research (offline) → Shadow validation (staging) → Human-reviewed pilot (production shadow) → Feature flag controlled rollout → Full automation when stable.

---

## Operational notes (current repo)
- `src/server.ts` normalizes catastrophic SSR errors and renders `renderErrorPage()` for 500 responses.
- `src/start.ts` wires global middleware including `attachSupabaseAuth` from `src/integrations/supabase/auth-attacher.ts` which attaches the session bearer token to client-side function calls.
- `src/integrations/supabase/client.server.ts` enforces the presence of SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — keep these in CI/secret manager and never in the repo.

---

## On-call and incident response
- On-call engineers must be able to read logs, revert to the last good tag and run the rollback playbook.
- For any incident causing customer-visible degradation, produce a postmortem with root cause and action items within 72 hours.

---

## How to request an exception
- Open a short RFC in the PR, include risk analysis and rollback plan. Requires senior engineer + CT O approval.

(End of ENGINEERING_HANDBOOK.md)
