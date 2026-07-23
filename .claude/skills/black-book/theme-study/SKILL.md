---
name: black-book-theme-study
description: Use when conducting studies for specific themes (e.g. redlining, urban renewal) or drafting ThemeImpactPackets. Triggers on "theme study", "write theme", "thematic study", "theme packet", "redlining study".
---

# Thematic Study & Theme-Impact Packet Curation

This guide details the repeatable pattern for running thematic studies, identifying entities, finding relationships, and drafting `ThemeImpactPacket`s using the deterministic ingestion harness and the LLM Enrichment Bridge.

All thematic drafts are staged as proposals in the `theme_impact_packets` table in `bb_reference` or `bb_canonical` and must pass through human review before release projection.

---

## 1. Thematic Study Workflow: Step-by-Step

```
[Target Theme & CBSA] 
       │
       ▼
1. RUN HARNESS (Deterministic)
   - Fetch: NPS Network to Freedom, DPLA, SHPO GIS, Chronicling America
   - Resolve: Match candidates deterministically against the canonical catalog
   - Overlap: Spatial (geohash, HOLC polygon) and Temporal (policy era)
       │
       ▼
2. ENRICH & ADJUDICATE (LLM Bridge)
   - Prompt: Provide deterministic candidate graph + raw source excerpts
   - Task: Backfill missing coordinates/attributes, extract relationship edges, draft narratives
       │
       ▼
3. STRUCTURE PACKET
   - Compose: ThemeImpactPacket payload conforming to ADR-029 schema
   - Validate: Juxtaposition-not-causation, disclaimer_key, gap_states
       │
       ▼
4. STAGE FOR REVIEW
   - Save: Commit to db; human operator reviews and promotes to public projection
```

---

## 2. Step 1: Running the Deterministic Ingestion Harness

Execute the non-LLM based harness to crawl, query, and structure the raw source materials for a specific theme or metro area.

```bash
# Example: Gather DPLA records and SHPO listings for Chicago redlining study
node --conditions development --import tsx packages/operator-cli/src/bin.ts harness-run \
  --theme redlining \
  --metro metro:chicago-il \
  --connectors dpla,nps-network-to-freedom,shpo \
  --output /tmp/chicago-redlining-raw.json
```

The output will contain standardized, geocoded candidate stubs, historical timelines, and spatial-temporal adjacency mappings (e.g. matching entities to HOLC D-graded polygons and Census tracts).

---

## 3. Step 2: LLM Enrichment and Adjudication

Use the LLM Enrichment Bridge to analyze the gathered raw JSON and synthesize the thematic study.

```bash
# Run enrichment using OpenRouter or local Corsair Ollama over Tailscale
node --conditions development --import tsx packages/operator-cli/src/bin.ts harness-run \
  --theme redlining \
  --input /tmp/chicago-redlining-raw.json \
  --enrich \
  --provider openrouter \
  --model google/gemini-2.5-pro:free \
  --commit
```

### Prompt Context Pattern
When calling the LLM through the bridge, the prompt should provide:
1. **Raw Excerpts:** Full text snippets gathered deterministically.
2. **Contextual Metadata:** Neighboring entities, HOLC grades, and Census tracts.
3. **Task Instructions:**
   - Extract missing facts (dates, organizations, specific addresses).
   - Identify relationships (e.g. founder, donor, attendee, neighbor) using the taxonomy in `docs/relationship-taxonomy.md`.
   - Draft the historical narrative answering a canonical question (Q1–Q12).

---

## 4. Step 3: Structuring a Theme-Impact Packet

A completed thematic study must be structured as a `ThemeImpactPacket` conforming to the design guidelines in `docs/research/theme-impact-packet-system.md`:

- **`questionId`:** e.g., `Q3` (homeownership shifts across credit eras).
- **`themeId`:** e.g., `redlining`.
- **`geography`:** Must declare CBSA/county FIPS codes, `boundary_version`, and display labels.
- **`methodStance`:** Always defaults to `juxtaposition`. Set to `gated_causal_claim` only when backed by an approved primary source.
- **`gapStates`:** Be honest. Explicitly label modeled metrics (e.g., Opportunity Atlas incarceration estimates) and document missing series.

---

## 5. Hard Curation Rules

1. **Juxtaposition by Default:** Never state that redlining or historical policies *automatically caused* modern disparities unless the LLM is citing a specific, peer-reviewed study, and even then, display it behind a causal claim gate.
2. **Dignity in Mapping:** Never map violent events or trauma with alarm colors. Point precision must match record precision.
3. **No Anonymous Cites:** All claims must resolve to an immutable canonical claim version with a valid citation URL and content hash.
4. **Archive Citations:** Verify that the citations included in the theme or story have valid Wayback Machine URLs or content-addressed database captures.
