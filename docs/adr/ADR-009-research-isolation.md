# ADR-009: Research isolation

- **Status:** Accepted
- **Date:** 2026-07-16
- **Bead:**
- **Depends on:** ADR-003, ADR-005, ADR-007
- **Implements toward:** , research engine beads (+)

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| `workers/research` | Health stub in uv workspace | Isolated jobs + credentials |
| GCP/Firebase project split | One live production project: `black-book-efaaf` | Deferred four-project migration when triggers in D-013 are met |
| LLM publishing | N/A (no LLM wiring) | LLMs cannot publish or approve claims; public render never calls LLM |

## 2026-07-16 addendum — equivalent isolation inside one project

The user selected `black-book-efaaf` as the one production project. A dedicated research project is
deferred; it must not be represented as live or created by . The non-publishing invariant is
now enforced by a distinct `research` SA, no public-media/release/deploy grants, `role_research`,
private job ingress, separate secrets/logs/quotas, and a research kill switch.

This is weaker blast-radius isolation than a project split because an accidental broad project role
can bypass resource IAM. Re-split research when its untrusted-input risk, cost, compliance, incident
containment, or recovery needs cannot be bounded by SA, bucket, database, network, quota, and
kill-switch controls (D-013).

## Context

Research ingests untrusted external sources, URLs, and (later) model outputs. That workload is high-risk for SSRF, poisoning, and cost runaway. Isolation must ensure research credentials cannot modify public projections or activate releases, and that optional research can soft-stop before public serving is harmed.

## Decision

1. Use **equivalent lower-layer isolation** for production research in `black-book-efaaf` now; retain a dedicated project as the preferred migration target (/D-013).
2. **Research service account** may write research/evidence staging only; **cannot** modify public projections, release pointers, or publication activation.
3. **Research workers cannot publish**; **LLMs cannot publish or approve their own claims**; **public rendering never invokes an LLM** (invariants 4–6).
4. Source adapters and campaigns run as **isolated research compute** — Firebase Functions v2 schedules for capped discovery (ADR-018) and/or **Cloud Run Jobs** for long batch — with budgets, concurrency caps, and kill switches (ADR-007, ADR-018).
5. Cross-project access is **explicit and minimal**; public services cannot read private evidence blobs; quarantine objects are not publicly serveable.
6. Promotion to public requires the **publication workflow** via internal/publication identities only (ADR-004, ADR-005).
7. External URLs/files are untrusted; fetches happen in security/research workers with SSRF controls, never in public request handlers.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Research jobs using publication DB role “for convenience” | Single bug publishes poisoned data. |
| Running research in the public API process | Shares fate and credentials with anonymous traffic. |
| LLM-in-the-loop auto-publish | Violates non-negotiable invariants. |
| Same Storage bucket for quarantine and public media | Quarantine could be served publicly. |
| Per-adapter microservice fleet | Over-decomposition; adapters are libraries/jobs under `workers/research`. |

## Consequences

- Same-project operation is simpler now but has greater IAM and billing blast radius.
- Data movement research → canonical → public is always mediated and auditable.
- Cost controls stop research before they stop public corpus serving.
- Future LLM framework (/065) must inherit these isolation rules.

## Migration triggers

- Move research to a dedicated project when the D-013 migration triggers are met.
- Add upload quarantine boundary as an extension of security isolation, not research publishing rights.
- Expand model tool use only after prompt-injection isolation bead.

## Rollback considerations

- Disable research campaigns and adapters via kill switches without rolling back public releases.
- Revoke research IAM first when compromise is suspected; rotate DSNs and invalidate outbox consumers.
- Quarantine suspect evidence; do not mass-delete audit trails.
- Public site continues on last good release (ADR-004).
