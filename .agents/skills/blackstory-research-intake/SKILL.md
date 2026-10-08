---
name: blackstory-research-intake
description: Use when the owner hands over a URL or topic and wants it turned into a proposed lead, fetched safely, cited, and opened as a draft research case. Triggers on "add this lead", "look into this URL", "research this place/person", or a pasted link with a research request.
---

# Research intake

Repository workflows require the BlackStory checkout; configured remote management clients do not. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Canonical how-to (invocation, guardrails, Do/Never) lives in
[`docs/research/research-operations.md`](../../../docs/research/research-operations.md#research-intake).
Read that section before running `research-intake`. This file is a CLI pointer. It carries
no command detail of its own.

`--location` and `--era` on intake are unverified labels. Confirming which entity, where it
was, and which period it belongs to is `blackstory-entity-verify`.

## End-to-end owner requests

For requests spanning research through publication, follow the
[shared management workflow](../../../docs/research/research-operations.md#account-owned-management-work).
Infer scope, carry existing authorization forward, and present one concise review. Use the
remote service only when deployed and verified; its current limits are part of that contract.

Session research uses the active harness's web tools and shared ledger by default. The management
`research_work` protocol exposes the evidence schemas and checkpoints without a hosted provider.
Do not turn an intake request into a Brave or GitHub setup task. Use hosted execution only when
independent background work is requested and configured.
