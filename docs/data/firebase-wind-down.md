# Retired provider boundary

Firebase and Firestore are not supported components. The application uses Supabase Postgres,
Supabase Auth, Supabase Storage, and Vercel. Research workers use explicit configured providers;
Corsair is not an execution target. Scheduling capability is inert until explicitly invoked, and
this repository installs no schedules.

The repository contains no Firebase SDK, emulator setup, document-store adapter, Firebase backup
job, or deployable Firebase resource. Historical applied SQL migrations retain their original
identifiers because changing recorded migration contents would invalidate deployment history.
Negative regression tests may name a retired dependency to prohibit its reintroduction.

Repository removal does not delete external projects, stored data, identity accounts, or billing
obligations. Live resource deletion has not been performed by this refactor. Before decommissioning
an external account, inventory retained resources, verify needed exports and current Supabase
captures, and confirm that no public URL depends on them. Keep destructive account cleanup separate
from code changes.

[Architecture](../architecture.md) and [storage](supabase-storage-cutover.md) describe current
behavior. This document is not a compatibility or fallback runbook.
