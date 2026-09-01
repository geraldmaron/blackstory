# Internet Archive handoff

**Status:** binding for record pages (2026-09).  
**Code:** `apps/web/src/lib/geography/internet-archive-sources.ts`, `RecordArchiveSources.tsx`, `RecordArchiveContribution.tsx`.  
**Related:** [`patterns-visit-handoff.md`](./patterns-visit-handoff.md), [`../methodology/capture-and-aggregators.md`](../methodology/capture-and-aggregators.md).

---

## Intent

BlackStory preserves cited sources through outbound links and Wayback capture, and surfaces **already-cited** Internet Archive items on record pages. This is inbound reader UI only: no live IA search box on every record.

---

## Inbound (Phase D)

`resolveInternetArchiveSources()` scans public claim `citationHref` values for:

| Pattern | Kind |
|---|---|
| `archive.org/details/{identifier}` | `details` |
| `web.archive.org/web/{timestamp}/{url}` | `wayback` |

`RecordArchiveSources` renders:

- **Archived copies** heading
- Linked titles from citation labels
- Mono detail line (`Internet Archive item` or `Wayback capture of …`)
- Compact contribution handoff link

### Surfaces

| Surface | Placement |
|---|---|
| `/entity/[id]` column | After "What the sources say" when IA links exist |
| Table of contents | "Archived copies" with count |

---

## Outbound (Phase E, minimal)

Full IA upload integration is operator-gated and deferred. Shipped now:

- `/methodology#internet-archive` explains capture + staged export posture
- `RecordArchiveContribution` links readers to that section
- Operator workflow remains CLI capture/export (see methodology copy)

Future work: `archive-export --entity-id` verb, IA identifier on evidence rows, curated collection uploads after rights review.

---

## Tests

| Module | File |
|---|---|
| URL parsing + claim scan | `internet-archive-sources.test.ts` |
