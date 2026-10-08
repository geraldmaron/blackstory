---
name: blackstory-locate
description: Use when a sourced street or named-place address already exists and must be Census-geocoded to lat/lng with no LLM. Triggers on "geocode this address", "run locate for this sourced address", "Census geocode EntityLocation". Not for finding or confirming where an entity was.
---

# Locate (Census geocode a sourced address)

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Canonical how-to (invocation, precision policy, Do/Never) lives in
[`docs/research/research-operations.md`](../../../docs/research/research-operations.md#locate).
Read that section before running `locate`. This file is a CLI pointer. It carries no
command detail of its own.

`locate` needs an already-sourced address. Finding the place, confirming which namesake
this is, choosing precision honestly, and assigning era is
[`blackstory-entity-verify`](../blackstory-entity-verify/SKILL.md). Do not invent an address so this
verb has something to geocode.
