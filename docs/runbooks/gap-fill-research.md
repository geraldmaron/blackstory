# Gap-fill research (Corsair)

Finds entities mentioned in published records' claims but not yet in the
catalog (e.g. a plantation founder named in a claim, a civil-rights case
referenced by three different entities) and researches them for real —
fetches sources, judges evidence, confidence-gates promotion. Single entry
point: `scripts/run-gap-fill-research.sh`. Staging only by default — never
publishes; a separate, explicit, human-run step does that.

## What it does

1. **Gap scan** — `packages/firebase/scripts/find-catalog-entity-gaps.ts
   --apply`. Scans every published entity's claims for named mentions;
   resolves matches against the existing catalog into `mentionedEntityIds`
   (feeds the separate relationship-backfill workstream's `mutual_mention`
   signal); stages everything else as `discovery-candidate.v1` stubs under
   `packages/firebase/fixtures/discovery-candidates/gap-fill-*.json`. Full
   sweep — expensive to re-run when nothing new has published; pass
   `--candidates <path>` to skip this phase and reuse an existing file.
2. **Subject building** — `build-gap-fill-enrichment-subjects.ts`. Real
   source material per candidate:
   - Primary lookup: **Wikipedia's own Search API**
     (`en.wikipedia.org/w/api.php`), not SearXNG — see "Why not SearXNG"
     below.
   - Tier-1 corroboration: follows that page's own citation trail
     (`lib/corroborate-source.ts`) first; only falls back to a
     throttled SearXNG search if nothing turns up there.
   - Fetching goes through `lib/safe-fetch.ts` (SSRF-safe, DNS-pinned) with
     Trafilatura extraction (`lib/trafilatura.ts`, ADR-019) layered on top.
3. **Enrichment** — `operator-cli enrichment-run --provider hybrid`. Same
   free-model roster + Ollama failover as the overnight pipeline.
4. **Auto-promotion** — `auto-promote-corsair-keeps.ts`. Real multi-source
   confidence engine (`lib/confidence.ts` — the same weighted
   sourceAuthority + lineageIndependence + ... formula `canonicalClaims`
   uses), not a binary Tier-1-domain check. A claim's evidence is its own
   citation plus the subject's independently-found corroborating source when
   one exists — this is what lets a Wikipedia-sourced claim clear the
   publish threshold when a real Tier-1 source corroborates it, instead of
   being permanently capped at one source.

## Why not SearXNG for the primary lookup

SearXNG proxies five free engines (Brave, DuckDuckGo, Google CSE, Startpage,
Wikipedia-via-scrape); each enforces its own rate limit and they go down
**together** under real load, however gently the caller throttles — verified
directly on 2026-07-20: a single healthy poll (19 results) was immediately
followed by a 182-candidate run getting zero results across every engine,
including Wikipedia. Wikipedia's own official Search API is a completely
different, unthrottled path and stayed available the entire time SearXNG's
scraped Wikipedia engine was suspended. SearXNG is still useful as a
last-resort fallback (a subject with no Wikipedia article), but treat it as
unreliable under any real load, not the primary mechanism.

## Host

Same as [overnight hybrid enrichment](./overnight-hybrid-enrichment.md#host)
— Corsair, `100.119.72.84`, `~/Developer/Projects/blackstory`.

Additional requirement: **uv** (for the Trafilatura Python bridge) —
`curl -LsSf https://astral.sh/uv/install.sh | sh`, installs to
`~/.local/bin`. The script bootstraps `PATH` for this automatically; a fresh
Corsair setup still needs the one-time install.

## Run

```bash
ssh gerald@100.119.72.84
cd ~/Developer/Projects/blackstory
./scripts/run-gap-fill-research.sh                       # full pipeline, fresh gap scan
./scripts/run-gap-fill-research.sh --candidates packages/firebase/fixtures/discovery-candidates/gap-fill-<stamp>.json
MIN_MENTIONS=3 MAX_CANDIDATES=100 ./scripts/run-gap-fill-research.sh
```

| Variable | Default | Meaning |
|---|---|---|
| `MIN_MENTIONS` | 2 | Only research candidates mentioned by this many catalog records or more (cross-reference count is the priority signal — see the 2026-07-20 finding below) |
| `MAX_CANDIDATES` | 200 | Cap (hard max 400) |
| `GAP_FILL_CONCURRENCY` | 4 | Parallel workers for fetch + enrichment |

`MIN_MENTIONS` isn't a perfect filter on its own — even multi-mentioned
candidates include noise (a company mentioned only as someone's employer,
e.g. NASA/IBM/Columbia). That's expected: the enrichment judge and
confidence gate are the real filters downstream (a mention with no
evidenced Black-history claim of its own correctly lands in
`needs_evidence`), not something to over-engineer at the search layer.

## After it finishes

```bash
cat .cache/gap-fill-enrichment/run-*.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['keepCount'], d['rejectCount'], d['needsEvidenceCount'])"
cat .cache/auto-promotion/report-gap-fill-*.json   # promoted + held-with-reasons
```

Review `packages/firebase/fixtures/national-catalog/auto-promoted-gap-fill-*.json`
before publishing. Publish (separate, explicit, human-run — never automatic):

```bash
DRY_RUN=1 node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts
APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts
```

## Known-fixed failure modes (2026-07-20)

If you hit one of these, it's a regression — the fix is committed, check
`git log` for the relevant file before re-debugging from scratch:

- **OpenRouter model rotation stuck on one model** — must advance to the
  next roster model on ANY error (a 400 "model doesn't support this
  response_format" is non-retryable but still means "try a different
  model"), not just retryable HTTP statuses. `llm-provider.ts`.
- **Every real page fetch returns nothing, `foundAnySource: 0` even against
  known-good URLs** — check whether `lib/safe-fetch.ts`'s `parseTextOnly` is
  actually wired in (not the shared `@repo/security` `parseContentInSandbox`
  directly, which flags any `<script>` tag as unsafe and rejects the whole
  fetch — correct for a render/execute consumer, wrong for this text-only
  one).
- **`pytest` fails with "no such file or directory" on an old repo path** —
  stale `.venv` shebang from before a repo rename; `rm -rf .venv && uv sync
  --group dev`.

## Related

- [Overnight hybrid enrichment](./overnight-hybrid-enrichment.md) — the
  general Wikimedia-discovery pipeline this shares its enrichment/confidence
  machinery with.
- ADR-019 (acquisition crawler runtime) — Trafilatura extraction, Scrapy
  reserved for recurring institutional-collection crawl campaigns (a
  separate, larger piece of work, not built as part of this pipeline).
- Relationship backfill workstream (repo-fh8u) — consumes this pipeline's
  `mentionedEntityIds` patches.
