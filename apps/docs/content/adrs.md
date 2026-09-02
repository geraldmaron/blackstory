---
title: Architecture decisions
description: Pointers into the historical ADR set and the current stack.
nav: reference
order: 2
---

# Architecture decisions

Formal ADRs were removed from the repository 2026-07-24. History is in git
(`git log -- docs/adr/`). Still-binding invariants live in
[`docs/decisions-carryover.md`](https://github.com/geraldmaron/blackstory/blob/main/docs/decisions-carryover.md).

The current stack (verified 2026-08-28 against live blackstory.app):

- Public web: **Vercel** (Cloudflare in front). Not Firebase App Hosting. Not Cloud Run.
- Data and media: **Supabase** project `blackstory-app`
  (`https://twykhihqkcldpreuovay.supabase.co`).
- Leftover, not current SoR: Firestore, Firebase App Hosting, GCS dual-serve,
  parked PostGIS.

See [Architecture](./architecture.md) for the full table. Filenames and older
runbooks may still say "firebase" for history. Titles that still read as current
hosting or SoR are leftover unless they match that table.
