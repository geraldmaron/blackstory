---
title: Architecture
description: Current system authority and how to challenge it.
nav: concepts
order: 1
---

# Architecture

BlackStory publishes evidence-backed Black history connected to people and places. Public web
and staff administration share `apps/web`. Supabase Postgres and Storage hold canonical data
and media; Vercel hosts the web application behind Cloudflare.

The maintained source is [Architecture](https://github.com/geraldmaron/blackstory/blob/main/docs/architecture.md),
with a [current engineering contract](https://github.com/geraldmaron/blackstory/blob/main/docs/decisions-carryover.md)
and [research framework](https://github.com/geraldmaron/blackstory/blob/main/docs/research/README.md).
These describe implementation owners, known gaps, and the evidence needed to challenge a choice.
Historical decision documents do not overrule current requirements or observed behavior.

Research commands run explicitly, independently of a chat session. They stage proposals and
cannot publish. The kernel, durable external-worker protocol and private evidence-level retrieval
share explicit contracts. Their operational and quality limits are documented in the research framework. No research schedule or personal workstation is required.
