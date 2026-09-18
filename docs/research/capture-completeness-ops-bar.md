# Capture completeness ops bar

Capture completeness measures recoverable evidence for cited web URLs. A capture row or content
hash alone is not a preserved page. Operators must report the representation that actually exists
and keep the live URL, historical availability, and current-revision anchor separate.

## What the evaluator measures

`packages/domain/src/capture-completeness/` exposes the policy ratio and
`evaluateCaptureCompleteness(citations)`. Its denominator is URL-backed citations; structured
offline designations follow a different custody path. A citation enters the archived numerator
only when it has all of:

- a capture id;
- a timestamped `web.archive.org/web/…` capture URL naming the exact cited original; and
- a valid archive completion timestamp matching that URL.

The configured `0.95` ratio is a policy threshold, not a measured preservation rate and not a
claim that 95 percent of source content is locally recoverable. The evaluator is pure: it never
submits Save Page Now (SPN) jobs or writes records.

## Representation tiers

Report these tiers independently. Higher rows do not erase the lower-level evidence.

| Tier | Evidence | What it establishes | What it does not establish |
|---|---|---|---|
| cited URL | flat released claim `citationHref` | a public claim depends on this URL | any capture exists |
| metadata capture | `source_captures` id, response metadata, and raw-response hash | retrieval identity and integrity metadata exist | page text or raw response bytes are recoverable |
| extracted text | an authorized `supabase-storage` object and retained passage/text records | sanitized extracted text is locally recoverable | original response bytes, layout, images, or attachments are retained |
| archive available | `waybackAvailabilityUrl` from the availability API | Internet Archive reported a historical snapshot | that snapshot matches the current fetched revision |
| current revision anchored | completed `waybackCaptureUrl`/timestamp from the URL + content-hash SPN job | the backfill completed an archive job requested for that fetched revision | identical fetched/archived bytes, truth of the claims, or permanent availability |

The local safe-fetch boundary hashes raw response bytes but does not expose or retain those bytes.
Neither metadata-only nor extracted-text storage should be described as a raw-page copy.

## Active-release inventory and tier query

Released entity claims use flat `citationHref` and `citationSource` fields. `citationHref` is the
URL denominator; `citationSource` is a label or publisher and must not be treated as a nested
citation URL. `capture-backfill` is authoritative for normalized, deduplicated URL inventory
counts. The domain evaluator remains citation-level: if one URL is cited three times, it
contributes three citations to that ratio. The backfill report always includes `totalUnique` and
`inventoryFingerprint`, even when a bounded batch is planned. These are separate measures and must
not be compared as if they shared a denominator.

This SQL inventories entity citations only, using exact URL matches. Compare its URL count with
`capture-backfill.inventory.entity.unique`, not the all-surface `totalUnique`. Investigate any
remaining difference as URL-normalization drift. Archive counters below are stored-pointer
inventories; the publication selector additionally validates the exact original URL, timestamp
and authoritative completed job before delivering a link.

```sql
WITH active AS (
  SELECT release_id
  FROM published.active_release
  WHERE id = 'active'
),
citation_urls AS (
  SELECT DISTINCT claim->>'citationHref' AS source_url
  FROM published.release_entities re
  CROSS JOIN LATERAL jsonb_array_elements(re.claims) AS claim
  WHERE re.release_id = (SELECT release_id FROM active)
    AND jsonb_typeof(re.claims) = 'array'
    AND claim->>'citationHref' ~* '^https?://'
),
url_tiers AS (
  SELECT
    cu.source_url,
    bool_or(co.capture_id IS NOT NULL) AS has_capture_metadata,
    coalesce(bool_or(
      co.storage_object->>'stored' = 'supabase-storage'
      AND co.storage_object->'preservationDecision'->>'sensitivity' = 'public'
      AND co.storage_object->'preservationDecision'->>'allowTextRetention' = 'true'
      AND NULLIF(co.storage_object->'preservationDecision'->>'expiresAt', '')::timestamptz > clock_timestamp()
    ), false)
      AS has_extracted_text,
    coalesce(
      bool_or(co.storage_object->>'waybackAvailabilityUrl' ~* '^https://web\.archive\.org/'),
      false
    ) AS has_archive_available,
    coalesce(
      bool_or(
        co.storage_object->>'waybackStatus' = 'anchored'
        AND co.storage_object->'preservationDecision'->>'sensitivity' = 'public'
        AND co.storage_object->'preservationDecision'->>'allowArchive' = 'true'
        AND NULLIF(co.storage_object->'preservationDecision'->>'expiresAt', '')::timestamptz > clock_timestamp()
        AND co.storage_object->>'waybackCaptureUrl' ~* '^https://web\.archive\.org/'
        AND co.storage_object->>'waybackCapturedAt' IS NOT NULL
      ),
      false
    ) AS has_current_revision_anchor
  FROM citation_urls cu
  LEFT JOIN evidence.capture_origins co
    ON co.source_url = cu.source_url
   AND co.retention_revoked_at IS NULL
  GROUP BY cu.source_url
)
SELECT
  count(*) AS distinct_cited_urls,
  count(*) FILTER (WHERE has_capture_metadata) AS metadata_captures,
  count(*) FILTER (WHERE has_extracted_text) AS extracted_text_captures,
  count(*) FILTER (WHERE has_archive_available) AS archive_available,
  count(*) FILTER (WHERE has_current_revision_anchor) AS current_revision_anchored,
  count(*) FILTER (WHERE NOT has_current_revision_anchor) AS current_revision_missing
FROM url_tiers;
```

## Deterministic bounded backfill

A commit without an explicit bound stops after 25 URLs. Dry-run remains unbounded and performs no
fetch or write, so it can report the complete inventory.

For an explicitly reviewed citation, target it directly:

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts capture-backfill \
  --url "https://example.gov/cited-record" --commit --wayback \
  --preservation-decisions decisions.json
```

The normalized URL must already exist in the cited inventory. Exact targeting cannot be combined
with count, entity, or cursor batching.

For repeatable count batches:

1. Run `capture-backfill --max-captures 25` and record `inventoryFingerprint` and `nextCursor`.
2. Commit the reviewed batch with the same count and any required preservation decisions.
3. Resume with `--after-url <nextCursor> --inventory-fingerprint <inventoryFingerprint>`.
4. Stop when `hasMore` is false. Failed fetches intentionally advance the traversal cursor; retry
   each URL listed in `failedUrls` with an explicit `--url` run.

`--max-entities` is a first-N entity selection for a bounded, non-resumable pass. It cannot be
combined with `--after-url`; retry failures from that pass with an explicit `--url`.

The URL order is deterministic. A changed inventory fingerprint or a cursor absent from the
selected inventory fails closed, preventing newly inserted earlier URLs from being silently
skipped. The fingerprint is traversal integrity, not evidence integrity.

## Cost and policy controls

`--wayback` is only a request to use the existing SPN client. It does not create permission to send
a private, signed, sensitive, or rights-restricted URL to a public archive. Preservation decisions
remain mandatory where the anchor requires them. Availability lookup is read-only and does not
replace a current-revision save.

The repository defines `source_fetch` budgets, but operators must verify that the live
capture-backfill request path is charged to that ledger before treating those limits as enforced.
Until that is demonstrated, use the executable 25-URL bound and the smaller reviewed batch needed
for the task. Do not infer a daily request rate from URL counts: SPN submission and polling can use
more than one request per URL.

## Non-goals

- Claiming full-page preservation from a hash, capture row, or excerpt
- Treating an availability hit as the current content revision
- Running an unreviewed full-inventory commit or unbounded SPN fan-out
- Treating archive presence as corroboration of a historical claim

## Related docs

- `docs/research/research-operations.md`: executable capture-backfill commands
- `docs/research/capture-remediation-runbook.md`: citation remediation workflow
- `docs/methodology/capture-and-aggregators.md`: public narrative and source access
- `docs/security/cost-resource-controls.md`: configured resource controls
- `packages/domain/src/facts/publish-gate.ts`: per-fact publication gate
