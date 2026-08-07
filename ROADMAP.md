# KELTOŞ Roadmap (Business Roadmap)

All statements below are annotated with repository/infrastructure confidence markers:
- ✅ Verified — present directly in the repository
- 🟡 Inferred — strongly implied by code or patterns in the repository
- ⚪ External infrastructure — outside the repository (infra, cloud, services)
- 🔵 Planned — roadmap / recommended work

This roadmap is organized as a business roadmap for KELTOŞ (signal-magic-grab) with five phases. Each phase lists: Objective, Business impact, Technical tasks, and Success criteria.

---

## Phase 1 — Reliability (0–3 months)

Objective
- Deliver a rock-solid core platform that ingests and persists signals with high availability and predictable behavior. 🔵 Planned

Business impact
- Reduce customer churn and support load by minimizing missed or incorrect signals. Expected to improve retention and NPS. 🔵 Planned

Technical tasks
- CI pipeline: enforce lint → build → unit tests → integration smoke tests. 🟡 Inferred (package.json scripts present) + 🔵 Planned
- Protect cron/webhook: add HMAC signature verification to `/api/public/hooks/kpk-signals-cron`. 🟡 Inferred + 🔵 Planned
- Harden error handling and structured logging for SSR and server requests (server.ts). ✅ Verified (server.ts handles SSR errors) + 🔵 Planned
- Add basic monitoring and alerting for 5xx, latency, and cron failures. ⚪ External + 🔵 Planned
- Add regression tests around `src/integrations/supabase/*` (client.server, auth-attacher, types). ✅ Verified + 🔵 Planned

Success criteria
- CI passing on >95% of commits and all releases gated by CI. 🔵 Planned
- Cron webhook runs without failed writes for two consecutive weeks in staging. 🔵 Planned
- Error rate (5xx) < 0.1% and alerting configured. ⚪ External + 🔵 Planned

---

## Phase 2 — User Trust (3–6 months)

Objective
- Build trust signals for customers: transparency, reliable signal provenance, and support tooling. 🔵 Planned

Business impact
- Increased conversion from trial to paid users; reduced refund/chargeback risk for signal-driven decisions. 🔵 Planned

Technical tasks
- Signal provenance & audit: persist ingestion metadata (source, signature, ingestion time) alongside `kpk_signals`. 🟡 Inferred (kpk_signals table exists) + 🔵 Planned
- Data retention & export: provide export APIs and safe retention policy documentation. 🔵 Planned
- Privacy & compliance baseline: review Supabase RLS policies and privacy documentation. ✅/🟡 (types.ts & supabase clients present) + 🔵 Planned
- Customer-facing status page and incident communication playbook. ⚪ External + 🔵 Planned

Success criteria
- Provenance available for 100% of signals in staging; audit log queries return results within SLAs. 🔵 Planned
- Customer satisfaction (support tickets per 1000 signals) reduced by 50%. 🔵 Planned

---

## Phase 3 — Premium Growth (6–12 months)

Objective
- Introduce monetization and premium tiers for power users: higher throughput, historical exports, and lower latency SLAs. 🔵 Planned

Business impact
- Establish recurring revenue and higher ARPU via tiered plans. 🔵 Planned

Technical tasks
- Rate limiting and quota enforcement (per account / per API token). 🔵 Planned
- Background processing: introduce durable worker queue for heavy tasks (notifications, backfills). 🟡 Inferred + 🔵 Planned
- Billing integration and feature-flagged premium capabilities (e.g., faster delivery). ⚪ External + 🔵 Planned
- Instrument business metrics (signal-delivery SLA, conversion funnel). 🟡 Inferred + 🔵 Planned

Success criteria
- Launch of a paid tier with at least five pilot customers within 6 months of start. 🔵 Planned
- Signal delivery SLA honored for paid tiers (e.g., 99.5% within X seconds). 🔵 Planned

---

## Phase 4 — AI Decision Engine (12–18 months)

Objective
- Add supervised models and scoring layers that enhance signal classification and provide incremental automation while preserving auditability. 🔵 Planned

Business impact
- Increased value per signal through classification, scoring and signal enrichment — targeted upsell for premium users. 🔵 Planned

Technical tasks
- Build offline training pipelines and shadow-mode inference for models. ⚪ External + 🔵 Planned
- Implement human-in-the-loop validation and store model provenance with every AI inference. 🔵 Planned
- Monitor model drift and rollback thresholds; integrate metrics into observability stack. 🔵 Planned

Success criteria
- Models validated against historical signals with documented lift (precision/recall improvement). 🔵 Planned
- AI outputs are auditable and roll-backable; pilot with at least two customers. 🔵 Planned

---

## Phase 5 — Global Expansion (18+ months)

Objective
- Scale operations, multi-region deployment, localization and compliance for global customers. 🔵 Planned

Business impact
- Enter new markets and reduce latency for international customers, increasing total addressable market. 🔵 Planned

Technical tasks
- Multi-region Supabase or DB replicas and near-user endpoints (edge hosting). ⚪ External + 🔵 Planned
- i18n and localization of UI and email/notifications. 🔵 Planned
- Compliance (GDPR, region-specific rules) and data residency controls. ⚪ External + 🔵 Planned

Success criteria
- Region-specific deployments and compliance checklists completed for target countries. 🔵 Planned
- Latency improvement benchmarks met in target regions. 🔵 Planned

---

## Prioritization notes
- Phase 1 and Phase 2 are mandatory to retain and grow early paying customers.
- Phase 3 should be gated on Phase 1 success criteria being met.
- AI features (Phase 4) are high-leverage but higher-risk; require full observability and governance before production rollout.

(End of ROADMAP.md)
