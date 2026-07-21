# Black history data landscape — adversarial intake

**Purpose:** Durable intake of the 2026-07-21 landscape brief into BlackStory research planning. Records accepted opportunities, rejected claims, consolidations with existing work, live corpus evidence, cost envelope, and ADR-supersession intent for the data-landscape capitalization epic.

**Date:** 2026-07-21  
**Branch:** `research/data-landscape-capitalization`  
**Epic:** `repo-2ztn` (children `repo-2ztn.1`–`repo-2ztn.12`)  
**Sources:** `~/Downloads/black-history-data-landscape.md` (canonical text); `~/Downloads/BlackStory for Gerald.pdf` (image-heavy companion; not used as text SoT).

---

## 1. Live corpus snapshot (verified)

Queried against Supabase project `blackstory-app` on 2026-07-21:

| Metric | Count / size |
|---|---|
| `bb_public.release_entities` | 1,103 |
| `bb_public.search_index` | 1,103 |
| `bb_canonical.entities` | 666 |
| `bb_canonical.claims` | 0 |
| `bb_evidence.source_captures` | 4 |
| `bb_canonical.entity_embeddings` | 646 |
| `bb_reference.jurisdictions` | 0 |
| Database size | 260 MB |

**Implications:** The landscape brief’s “~1,101 records” claim is essentially correct for public release rows. Capture-at-intake is implemented in code but nearly absent in production. Claims table is empty relative to released entities. Jurisdiction polygons are not loaded — PostGIS geo-integrity cannot run yet. Disk headroom on Pro (8 GB included) is ample.

---

## 2. Policy: ADRs may be superseded

Owner direction (2026-07-21): existing ADRs are **not** load-bearing constraints for this program. New ADRs may supersede conflicting decisions — especially ADR-020 language that keeps product reads only behind Node `apps/api-public` and avoids Data API exposure.

What still binds without an ADR:

- Research never publishes; public render never calls an LLM.
- Dignity / living-person rules.
- Cost discipline on Supabase Pro (~$25 org plan; three projects may cost more — see §5).
- Thousands-of-users egress discipline.

---

## 3. Adversarial matrix

### 3.1 Accepted (true and actionable)

| Claim | Verdict | Follow-through |
|---|---|---|
| Empty quadrant: entity-shaped + machine-queryable + general Black history + place-indexed | **Accept** | Methodology narrative; quality before marketing |
| Umbra Search link-rot + post-2017 funding risk (*American Archivist*, Apr 2026) | **Accept** (review verified) | Capture completeness ops bar; methodology contrast |
| NRHP Multiple Property Listings (AA-filtered) are highest-ROI unused curated-net | **Accept** | Fixtures-first disabled adapter; no bulk OCR |
| Sequencing: quality → queryable surface → docs/license → public MCP | **Accept** | Geo + capture bars gate PostgREST marketing and MCP |
| PostgREST / Data API as developer read surface | **Accept as chosen target** | Published-only views + RLS; superseding ADR |
| Open API = support + dignity/license obligation | **Accept** | License + attribution policy with surface |

### 3.2 Rejected or rewritten (wrong on merits)

| Claim | Verdict | Why |
|---|---|---|
| “Migrate to get PostGIS/pgvector/RLS” as greenfield | **Rewrite** | Already in `supabase/migrations/` (extensions + RLS). Capitalize; do not re-migrate for theater. |
| Rush a marketed “Black history API” because none exists | **Reject (timing)** | `claims=0`, 4 captures. Confident API/MCP over that launders weakness. |
| Compete on scale with DPLA / Enslaved.org | **Reject** | Differentiator is structure, provenance, place — not row count. |
| Wikidata harvest via `ethnic group: African American` | **Reject as primary strategy** | Dignity/methodology risk. Prefer place-first / authority-first query packs. |
| Build public MCP before stable API + quality | **Defer** | Unlock criteria bead only; no implementation in this epic. |
| Expose `bb_canonical` / research schemas to `anon` | **Reject** | Even with ADR supersession: public = published/active-release views only. |

### 3.3 Consolidated (reuse; do not duplicate)

| Concern | Existing home | This epic owns |
|---|---|---|
| Source portfolio / adapters | Research process, `repo-tt2u.8` | New curated sources (MPL, Chronicling America, Wikidata place-first, DPLA gap) that feed the portfolio |
| Capture resume / rate | Acquisition runtime / `repo-tt2u.2` | Production completeness bar + Umbra methodology copy |
| Entity fill / enrichment | `repo-qc8w` | Integrity gates only (geo, capture, independence signal) |
| Operator/agent MCP | `repo-tt2u.7` | Clarifies **≠** public heritage MCP |
| Mobile/App Check reads | `apps/api-public` | Remains abuse-bounded path; dual-surface with PostgREST or measured collapse |

---

## 4. Chosen API posture

**Target:** Supabase PostgREST over narrow **published** views (active-release entities/search; statuses in published / corrected / superseded / deprecated). RLS: `anon` SELECT on those views only.

**Keep:** Research isolation; publish gate as DB invariant; living-person coarsening via view/RLS; rate limits / spend caps.

**Supersede (explicit new ADR):** portions of ADR-020 (and any API/mobile ADRs) that forbid Data API product reads or require all public reads through Node `api-public`. Dual-surface model (PostgREST for open developers; `api-public` for App Check / mobile) unless measured collapse is cheaper.

**Not in this epic’s ship:** public MCP implementation; mass Enslaved.org import; unbounded MPL PDF OCR; anon access to drafts/canonical/research.

---

## 5. Cost envelope (Supabase Pro × three projects)

Full envelope (egress model, hard defaults, soft-shutdown citations): [`supabase-pro-cost-envelope.md`](./supabase-pro-cost-envelope.md).

| Fact | Number |
|---|---|
| Pro org base | $25/mo |
| Compute credit | $10/mo (covers **one** Micro) |
| Extra Micro projects | ~+$10/mo each → three Micros ≈ **$35/mo**, not $25 |
| Disk included | 8 GB / project (this DB: 260 MB) |
| Egress included | 250 GB (traffic risk at thousands of users) |

**Hard defaults for this program:** spend caps on; Micro only; no PITR; no branching; free/local or hybrid LLM for research; fixture-first adapters; no bulk OCR campaigns; soft-shutdown kills `optional_research` before public serving; prefer CDN-cached / cacheable reads over chatty anon PostgREST fan-out.

---

## 6. ADR candidates to supersede

| ADR / constraint | Candidate action |
|---|---|
| ADR-020 “product tables not for Data API / public schema exposure” | Supersede for **published-read views** only; keep canonical/research closed |
| ADR-020 / mobile boundary requiring all reads via `apps/api-public` | Supersede to dual-surface (or collapse) with recorded decision |
| Any ADR that blocks PostGIS publish-time containment checks | Amend/supersede if present; geo gate is required on merits |
| ADR-011 historical Firestore-only geo posture | Already superseded in practice by ADR-020; no new work |

New ADR lands under the epic child “Superseding ADR — PostgREST published-read surface.”

---

## 7. Workstream map (epic children)

| WS | Title | Depends on |
|---|---|---|
| WS0 | This intake memo (closed when committed) | — |
| WS1 | Supabase Pro×3 + traffic cost envelope | WS0 |
| WS2 | PostGIS jurisdiction load + publish geo-integrity gate | WS0 |
| WS3 | Capture completeness ops bar | WS0 |
| WS4 | Citation independence review signal | WS0 |
| WS5 | NRHP MPL African American curated-net | WS0 |
| WS6 | Chronicling America fixtures-first adapter | WS0 |
| WS7 | Wikidata place-first portfolio queries | WS0 |
| WS8 | One-shot DPLA bulk gap analysis | WS0 |
| WS9 | Methodology / public narrative | WS3 |
| WS10 | Superseding ADR + PostgREST published views | WS0, WS2, WS3 |
| WS11 | Public MCP unlock criteria (implement later) | WS10 |

---

## 8. Sustainability rules (non-ADR)

1. Research never publishes; public render never calls an LLM.
2. New sources start **disabled** until policy approval.
3. Prefer fixtures + free/hybrid LLM over paid APIs.
4. Public machine access = **published views only**, whether PostgREST or Node.
5. Quality gates before marketing the empty-quadrant / “Black history API” story.
6. Prefer structural DB invariants (RLS, geo containment, capture completeness) over app-only discipline.

---

## 9. Key external references (from brief)

- DPLA API: https://pro.dp.la/developers · https://api.dp.la/v2
- Enslaved.org LOD dumps: https://docs.enslaved.org/lod/
- NRHP spatial (ArcGIS REST): http://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer
- NRHP data downloads: https://www.nps.gov/subjects/nationalregister/data-downloads.htm
- Postman “Where Are Black History and Culture APIs?”: https://blog.postman.com/where-are-black-history-and-culture-apis/
- Umbra Search review (*American Archivist*, Apr 2026): https://reviews.americanarchivist.org/2026/04/09/umbra-search-african-american-history/
- Wikidata MCP: https://www.wikidata.org/wiki/Wikidata:MCP
