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

| ADR | Topic |
|-----|-------|
| 001 | Firebase App Hosting vs Cloud Run |
| 004 | Public projection / immutable snapshots |
| 005 | Service surface separation |
| 006 | GitHub Actions deployment |
| 008 | Search and geocoding |
| 009 | Research isolation |
| 010 | Security and abuse assumptions |
| 011 | Firestore as system of record |
| 018 | Firebase scheduled functions for discovery |

Scaffold vs target is noted in each record. Cloud resources are not applied from
ADRs alone.
