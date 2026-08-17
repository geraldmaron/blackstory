---
name: blackstory-entity-complete
description: Fills gaps on a public entity record (image, related, historical context, topics) without publishing. Use when asking what is missing on this record, finding a primary image, adding related entities, filling historicalContext, or running a completeness pass.
---

# Entity complete

Judgment playbook for the fields the public entity page actually renders. Do not publish.
Stage, then stop.

Rendered anatomy (web + mobile) is the checklist. Source the audit
[`docs/research/entity-completeness-audit.md`](../../../../docs/research/entity-completeness-audit.md)
and the view-models: `apps/web/src/app/entity/[id]/entity-anatomy-facts.ts`,
`apps/mobile/src/features/entity/entity-anatomy-facts.ts`.

## What a reader sees

| Field | If blank | Lane |
|---|---|---|
| `whereLabel` / geo | Place withheld or missing pin | [`blackstory-entity-verify`](../entity-verify/SKILL.md) |
| `eraLabel` | Era undocumented | `blackstory-entity-verify` (designation years are not era) |
| `evidenceLabel` | Unrated / zero sources | [`blackstory-claim-corroborate`](../claim-corroborate/SKILL.md) |
| `summary` | Should not be blank on a released record | `blackstory-editorial-enrichment` (`backfill-entity` / `prose-run`) |
| `historicalContext` | Missing era/place paragraph | `prose-run` / `backfill-entity`, citation-gated |
| `topicTags` / `topicIds` | Topics missing | Canonical classification, then re-publish. Do not invent a parallel taxonomy column. |
| `primaryImage` | Largest live gap (~95% blank at last audit) | Image lane below |
| `related` | Related rail empty | `propose-edge` (see below). `expand` is still a stub. |

Minimum publishable *case* (identity, relevance, source citation, public summary, rights
clearance) is [`blackstory-case-drafting`](../case-drafting/SKILL.md). Geography, dates,
corroboration, and context are enrichment. The public anatomy still shows Where and Era
first, so treat those as verify work even when the case is technically minimum.

## Images

There is no bulk image-sourcing adapter. Rights clearance is a minimum-case field. Do not
hot-link a search result.

Contract: [`docs/ui/learning-index-entity.md`](../../../../docs/ui/learning-index-entity.md).
Promote a local, rights-cleared file with
`packages/firebase/scripts/promote-entity-primary-image.ts` (`--alt`, `--credit`,
`--rights`). Incomplete images are dropped at write (`preparePublicEntityProjectionForWrite`).

People in images need PERSON / ROLE / PLACE / YEAR. No anonymous decoration, no generic
"Black history" stock, no AI image presented as documentary.

**Never:** ship a portrait without rights; present a brand mark as the person's photograph;
scrape Wikimedia and assume public domain.

## Related entities

`propose-edge` is the verb. `expand` returns `not_implemented` until the network engine
exists.

- `--from-entity-id` / `--to-entity-id` / `--type` / `--source-url`
- Caused or enabled edges require `--causal-scope` (`systemic_consensus` with a consensus
  basis, or `contested_or_single_incident`). The CLI rejects a causal edge with no scope
  before quarantine.
- Juxtaposition is the default for theme/context data. Do not assert causation because two
  pins sit in the same county.

Dry-run default. `--commit` only after review. See
[`docs/research/research-operations.md`](../../../../docs/research/research-operations.md)
and `packages/operator-cli/src/cli.ts` (`propose-edge`).

## Backfill copy

Short-form `historicalContext` / summary drafts: `prose-run` or `backfill-entity` under
[`blackstory-editorial-enrichment`](../editorial-enrichment/SKILL.md). Linked prose uses
`[[ent_id|Display Name]]`. Citation rules stay `blackstory-claim-corroborate`. Never call
this ready to publish.

## Output

Per entity: field checklist (present / blank / blocked), proposed fills with source URLs,
and what must wait for a publication-role human.
