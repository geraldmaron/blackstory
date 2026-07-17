# ADR-007: Background workflow model

- **Status:** Accepted
- **Date:** 2026-07-16
- **Bead:** BB-002
- **Depends on:** ADR-005, ADR-009
- **Implements toward:** BB-018 (outbox), research/publication/security worker beads

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| `workers/{research,publication,security}` | uv packages + `health()` smoke | Cloud Tasks + Cloud Run Jobs |
| Queues / outbox | Not implemented | Transactional outbox + bounded queues |
| Cloud Tasks / Run Jobs | **Not configured** | BB-005+ infrastructure |

## Context

User requests must not synchronously fetch untrusted URLs, run research campaigns, or rebuild publications. Work must be bounded in concurrency and cost. Research must not publish; publication must not rewrite raw evidence. Reliability needs at-least-once delivery with idempotent handlers and auditable state transitions.

## Decision

1. **Cloud Tasks** for bounded asynchronous request-driven work (quarantine processing, deferred URL fetch, preview generation triggers, etc.).
2. **Cloud Run Jobs** for research campaigns, batch publication builds, and other long-running batch processing.
3. Worker code lives only in the three worker packages: **research**, **publication**, **security** — not new worker microservices.
4. Important state changes use an **append-only audit** trail and a **transactional outbox** so side effects are durable and replay-safe (BB-018).
5. Every queue and job has **rate, concurrency, duration, retry, and cost limits** (invariant 17; BB-033).
6. Handlers are **idempotent**; replays must not duplicate external effects.
7. **No synchronous untrusted URL fetch** in user request paths; enqueue for security workers (invariant 11).
8. Public web/API request paths never invoke LLMs or research jobs inline.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Inline background threads inside API processes | No isolation, poor scaling, shared fate with request serving. |
| Always-on custom queue fleet / Kafka for v1 | Operational overhead beyond beads’ Tasks + Jobs model. |
| One combined “worker” service for all job types | Breaks research/publication/security credential separation. |
| Fire-and-forget without outbox | Lost updates and unauditable gaps under crash. |
| Unlimited retries / unbounded fan-out | Cost and abuse amplification. |

## Consequences

- APIs become thin validators + enqueuers for expensive work.
- Observability must cover queue depth, retries, and job budgets (BB-034).
- Local dev needs emulators or explicit “sync fallback” flags that **cannot** be enabled in production.
- Publication activation remains a privileged internal/worker path (ADR-004).

## Migration triggers

- Introduce another queue technology only after Cloud Tasks limits block required throughput **and** cost controls remain enforceable.
- Add a new worker package only for a new **security domain** (e.g., BB-031 upload quarantine), not per source adapter.
- Split Jobs by campaign size when blast-radius or IAM needs differ — still within research/publication/security roles.

## Rollback considerations

- Pause queues / cancel Jobs via kill switches (BB-035) without taking public snapshot reads offline.
- Redeploy prior worker revisions; poison-pill messages go to quarantine, not infinite retry.
- Outbox replay from last checkpoint after fix; do not delete audit history.
