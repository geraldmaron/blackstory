# ADR-003: Firebase SQL Connect usage boundaries

- **Status:** Deferred / superseded (current phase) by [ADR-011](./ADR-011-firestore-system-of-record.md)
- **Date:** 2026-07-16
- **Bead:** BB-002
- **Depends on:** ADR-002, ADR-005

> **Phase note (2026-07-16):** SQL Connect templates under `infra/database/sql-connect/` are
> **parked**. TypeScript apps use Firestore Admin SDK / `@blap/firebase` for the production
> data path. Revisit only if Cloud SQL is reconsidered under ADR-011 triggers.

## Scaffold vs target

| Aspect | Today (verified) | Former target (parked) |
|--------|------------------|------------------------|
| `@blap/data-access` | Postgres helpers parked; Firestore module is primary | Live Admin SDK wrappers after generate |
| Firebase SQL Connect / connectors | Templates under `infra/database/sql-connect/` (parked) | Linked Cloud SQL + `dataconnect:sdk:generate` |
| Direct Postgres from Python workers | Not wired; not required this phase | Least-privilege DSN per worker role |

## Context

TypeScript services need typed, reviewable database operations with explicit authorization. Python research/publication/security jobs need efficient bulk and long-running access that should not be forced through a browser-oriented or over-broad connect surface. Credentials must encode schema privileges so a compromised public API cannot write canonical data.

## Decision

1. **Firebase SQL Connect** is the preferred path for **TypeScript application servers** (`api-public`, `api-submissions`, `api-internal`, and server-side admin data access) for **authorized, named operations**.
2. Every deployable SQL Connect operation has **explicit authorization** and maps to a least-privilege DB role.
3. **Public API** SQL Connect / DB role: **read-only** on approved **public** schemas/views/projections only.
4. **Submissions** role: write quarantine / intake tables only; **cannot** activate releases or mutate public projections.
5. **Internal / publication** role: write projections and release metadata; **cannot** modify raw evidence.
6. **Research** role (Python, usually direct Postgres): write research/evidence staging only; **cannot** modify public projections or publish.
7. **Public web / browsers** never use SQL Connect or any database credential.
8. Generated server-side TypeScript SDK lives behind `@blap/data-access` (or successor); apps do not embed ad-hoc SQL strings for user-shaped queries.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| SQL Connect for all clients including browsers | Violates invariant: public clients never connect to canonical (or any) DB. |
| Raw Postgres from every TypeScript service with no Connect | Harder to audit operation allowlists; still allowed only if Connect is unavailable for a specific trusted path, with equivalent allowlisting. |
| One shared “app” database user | Collapses role boundaries; submissions compromise could publish. |
| ORM unrestricted query builder exposed to request handlers | Enables user-shaped SQL, sort expressions, and column selection (forbidden by BB-026). |

## Consequences

- Operation allowlists become part of the security review surface (BB-012, BB-036).
- Python jobs keep direct Postgres with IAM/DSN rotation; dual access patterns must stay role-aligned.
- Schema changes may require regenerating Connect SDK and redeploying APIs in lockstep.
- Local development may use direct Postgres until Connect emulators/project wiring exist (BB-011/BB-012); production must not weaken roles for convenience.

## Migration triggers

- Expand Connect to additional schemas only with new role proofs and threat-model updates (BB-004).
- Replace Connect with another typed data layer only if Firebase product limits block required isolation; retain the same role matrix.
- Allow a TypeScript service temporary direct Postgres only under documented exception and time-boxed remediation.

## Rollback considerations

- Disable Connect connectors by revoking IAM and rotating credentials without dropping Cloud SQL.
- Fail closed: if Connect is unavailable, public APIs enter degraded read-from-snapshot mode rather than opening broader DB credentials.
- Keep migration and role SQL in version control so prior privilege sets can be reapplied.
