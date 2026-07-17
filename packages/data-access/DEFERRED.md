# Deferred: Postgres / SQL Connect / PostGIS (ADR-011 / D-014)

This package historically hosted Cloud SQL / SQL Connect helpers from BB-012.

**Current production path:** Firestore via `@black-book/firebase` converters +
`src/firestore/` in this package.

Postgres modules (`config`, `pool`, `roles`, `session`, `sql-connect/*`) remain
exported for optional local experiments and a possible future revisit. They are
**not** required for app boot, CI primary path, or production deploy.

Do not provision Cloud SQL unless ADR-011 migration triggers are met.
