---
title: Architecture decisions
description: Pointers into the ADR set that shapes the platform.
nav: reference
order: 2
---

# Architecture decisions

Formal ADRs live in the repository at
[`docs/adr/`](https://github.com/geraldmaron/blackstory/tree/main/docs/adr).

Selected topics:

| ADR | Topic | Status |
|-----|-------|--------|
| 001 | Public web host versus Cloud Run services | Accepted (Vercel for public web) |
| 004 | Public projection / immutable snapshots | Accepted |
| 005 | Service surface separation | Accepted |
| 008 | Search and geocoding (Postgres / PostGIS) | Accepted |
| 010 | Security and abuse assumptions | Accepted |
| 011 | Firestore as system of record | Superseded by 020 |
| 014 | Vector search (`pgvector`) | Accepted |
| 018 | Firebase scheduled Functions for discovery | Superseded by 028 |
| 020 | Supabase Postgres as system of record | Accepted |
| 026 | PostgREST published-read surface | Accepted |
| 027 | Vercel for public web hosting | Accepted (DNS cut complete) |
| 028 | Discovery schedule runtime (Corsair + Postgres) | Accepted |

Scaffold versus target is noted in each record. Filenames may still say “firebase” for link
stability; titles and status lines are authoritative. Cloud resources are not applied from ADRs
alone.
