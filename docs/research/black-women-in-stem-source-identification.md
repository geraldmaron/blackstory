# Black Women in STEM — source identity research

**Bead:** `repo-tt2u.8` (workstream `repo-srcwave`, parent epic `repo-tt2u`)  
**Status:** Identification incomplete — **no canonical source identity resolved in repository evidence**  
**Last repo search:** 2026-07-19

## Executive summary

Repository-wide search found **zero committed references** to a specific “Black Women in STEM” website, organization, domain, RSS feed, adapter, or registered source identity. The phrase appears **only** in the bead title for `repo-tt2u.8` inside the **modified (not yet in committed git history)** `.beads/issues.jsonl` file.

The owner program brief that created epic `repo-tt2u` explicitly states the intended source is **unresolved** and instructs agents **not to guess a domain** and **not to scrape** until identity and policy are confirmed. This document records that finding and separates **unresolved source identity** from **related corpus content** already in the national catalog.

---

## Candidate source identities (from repo evidence)

| # | Candidate | Type | Repo evidence | Confidence |
|---|-----------|------|---------------|------------|
| — | *(none)* | — | No domain, org name, feed URL, adapter ID, or `registerSource` entry names “Black Women in STEM” or an obvious synonym (BWIS, etc.) | **Not identified** |

**Result: empty candidate list for source registration.**

---

## Related repo evidence (not source identities)

These items are **theme-adjacent** but are **not** evidence that a particular “Black Women in STEM” source has been chosen, audited, or registered.

### 1. Bead graph (primary mention)

| Ref | Content |
|-----|---------|
| `.beads/issues.jsonl` — issue `repo-tt2u.8` | Title: **“Source portfolio wave one + Black Women in STEM identity research”**. Description is boilerplate workstream text; no URL, custodian, or domain. **File is modified locally; `git log -S "Black Women in STEM"` and `git log -S "repo-tt2u"` return no commits** — bead graph not yet in durable git history at search time. |
| `.beads/issues.jsonl` — issue `repo-tt2u` | Epic: “Entity acquisition, identification, enrichment, agent-native research”. Scope references “vertical slices A–E” and workstream 9 “Source portfolio wave one”. No BWIS domain. |
| `.beads/issues.jsonl` — issue `repo-tt2u.11` | “Evaluation, migration, rollout, vertical slices A–E” — vertical slice **D** is defined in the owner program brief (see below), not in bead body text. |

### 2. Owner program brief (session input — not versioned in `docs/`)

The 2026-07-19 owner assignment that spawned `repo-tt2u` (captured in the coordinating agent session, **not** found as a committed file under `docs/`, `plan.md`, or `docs/source-spec/`) includes:

| Section | Requirement |
|---------|-------------|
| Operator example | “Find overlooked Black women in STEM.” |
| **Source portfolio → Black Women in STEM** | “The exact intended source is **unresolved**. **Do not guess a domain.**” |
| Source-identification task | Search repo history and prior artifacts; identify plausible exact sources; record owner, domain, mission, content type, living-person presence; present candidates for **owner confirmation**; **no scraping until exact identity and policy are confirmed**. |
| Source-type fork (post-resolution) | Historical profile corpus · current professional directory · nonprofit community · blog · event site · media series · social-media-only · other. **Current professional directories must not be treated like historical public-domain corpora.** |
| Community lead index (generic) | “Professional organizations” and **“Black STEM communities”** as categories to **evaluate** — not named orgs. |
| STEM discovery signals (generic) | Favor biographies, institutional profiles, ORCID, publications, patents, grants, awards, museum/archive collections, government biographies, oral histories, society records — **none alone infers racial identity**. |
| Vertical slice **D** | Black women in STEM end-to-end demo **after** exact source ID, policy decision, living-person review — **not** by crawling an assumed domain. |
| Final acceptance **#28** | “The unresolved Black Women in STEM source is identified before implementation.” |

**Repo validation:** `rg` for `exact intended source is unresolved`, `Do not guess a domain`, `Vertical slice D`, `Find overlooked Black women` → **no matches** in tracked files. Treat program brief as **owner intent** pending durable check-in.

### 3. National catalog fixtures (entity content, not a BWIS source)

File: `packages/firebase/fixtures/national-catalog/business-science-invention-firsts.json`

Black women STEM **person entities** with cited authorities (examples):

| Entity ID | Name | Living? | Primary citation hosts (from fixture) |
|-----------|------|---------|--------------------------------------|
| `ent_katherine_johnson_001` | Katherine Johnson | Deceased | `nasa.gov` |
| `ent_dorothy_vaughan_001` | Dorothy Vaughan | Deceased | `nasa.gov`, `blackpast.org` |
| `ent_mary_jackson_001` | Mary Jackson | Deceased | `nasa.gov` |
| `ent_valerie_thomas_001` | Valerie Thomas | Living (retired NASA) | `nasa.gov` |
| `ent_marian_croak_001` | Marian Croak | **Living** | `invent.org`, `aaregistry.org` |
| `ent_shirley_ann_jackson_001` | Shirley Ann Jackson | **Living** | (see fixture) |
| `ent_bernard_harris_001` | Bernard Harris | **Living** | (see fixture) |

These records support **Vertical slice D themes** via **structured authorities** (NASA, NIHOF, etc.), not via a single “Black Women in STEM” third-party directory source.

### 4. Discovery scripts and query seeds

| Ref | Content |
|-----|---------|
| `packages/firebase/scripts/discover-candidates.ts` | Seed queries include `African American inventors`, `Black women suffragists` — **no** “Black women in STEM” or STEM directory query. |
| `packages/domain/src/query_packs/` | No STEM-specific or BWIS query pack files found. |
| `docs/research/query-packs.md` | General query-pack contract; no BWIS source. |

### 5. Registered / curated sources

| Surface | Finding |
|---------|---------|
| `packages/domain/src/adapters/rss/curated-feeds.ts` | Only seeded community feed: **The American Blackstory** (`theamericanblackstory.com`). No BWIS feed. |
| `packages/domain/src/external-data-sources.ts` | Demographics/context datasets (Opportunity Atlas, NHGIS, etc.). **No** BWIS or STEM directory entry. |
| `packages/domain/src/launch-corpora.ts` | NRHP, HABS/HAER, Green Book, HBCU list, etc. **No** BWIS corpus. |
| `docs/research/source-registry.md` | Adapter contract only; no BWIS mention. |

### 6. Git history

| Search | Result |
|--------|--------|
| `git log --all --grep="STEM" --grep="Black Women" -i` | No BWIS-specific commits; unrelated “STEM/system/design-system” hits only. |
| `git log -S "Black Women in STEM"` | **Empty** |
| `git log -S "repo-tt2u"` | **Empty** |

### 7. Configs, comments, docs

No matches in: `docs/source-spec/`, `infra/`, `workers/research/`, constitution schemas, or adapter definitions for `Black Women in STEM`, `BWIS`, `blackwomeninstem`, or `black-women-in-stem` (URL path or package slug).

---

## UNKNOWN — requires owner confirmation

1. **Which exact source** the name “Black Women in STEM” refers to (website, nonprofit, publication, database, social property, or internal working label for a **campaign theme** rather than one custodian).
2. **Custodian / publishing organization** and **registrable domain(s)** allowed for acquisition.
3. **Source lane and evidence role:** discovery lead only vs. entity-bearing corpus vs. community index (program brief lists options; none selected in repo).
4. **Access method:** official API, bulk export, RSS, sitemap, HTML crawl, or manual research only.
5. **Rights and retention:** snippet-only vs. selective capture; terms-of-use and robots evidence (none archived in repo).
6. **Living-person density:** whether the source is primarily **current professionals** (high sensitivity) vs. **historical profiles** (different policy envelope).
7. **Owner external research:** brief states owner “already completed external research” — **those notes are not present** in tracked repository files searched here. Owner should attach or commit identification memo (domain, screenshots, ToS links, robots snapshot) before adapter work.
8. **Relationship to Vertical slice D:** confirm whether slice D should demo **resolved BWIS source ingestion** or **multi-authority STEM campaign** (NASA/ORCID/PatentsView) without a single named BWIS directory.

---

## Living-person risk notes

Applicable even before source identity is resolved:

| Risk | Repo policy / context |
|------|------------------------|
| **Current professional directory** | Program brief: must **not** be ingested like historical public-domain corpora; expect elevated living-person controls, snippet/metadata limits, and no cross-source profile aggregation. |
| **Living subjects in existing STEM fixtures** | e.g. Marian Croak, Shirley Ann Jackson, Bernard Harris, Valerie Thomas — fixture claims cite public institutional sources; **not** a license to scrape third-party directories about living people. |
| **Constitution / BB-077** | `packages/domain/src/rights/living-person-ugc.ts` — no cross-source aggregation of living-person personal details; elevated confidence for UGC-derived living-person claims; deanonymization prohibited. Program invariants #9–10: unknown is acceptable; no unnecessary present-day sensitive data. |
| **Demographic inference** | Program invariant #7–8: do **not** infer Black identity from name, photo, institution, or model output; relevance must come from **explicit source evidence**. |
| **Citation in fixtures** | `aaregistry.org` (African American Registry) appears as a **secondary citation** on some living-person records — **not** identified as the BWIS source; separate rights audit would be required if ever registered as an adapter. |

---

## Explicit gate: no scraping until identity + policy confirmed

**Do not:**

- Resolve, invent, or assume a domain for “Black Women in STEM”
- Live-fetch, crawl, or probe URLs not already registered and approved in the source registry
- Register or enable an adapter based on name similarity to public organizations
- Treat national-catalog STEM person fixtures as proof that a BWIS **source** exists

**Proceed only after:**

1. Owner confirms exact source identity (custodian, domain, mission, content type)
2. Source audit completes per program brief (robots, terms, retention, living-person review, fixtures, disabled registration)
3. `repo-tt2u.1` (source governance unification) and audit bead `repo-tt2u.12` supply schema/path truth
4. Explicit approval through existing source-policy gate (`approveSourcePolicy`, canary, kill switch)

---

## Search terms used

Case-insensitive ripgrep and git history unless noted:

- `Black Women in STEM`, `black women in STEM`, `black-women-in-stem`
- `BWIS`, `blackwomeninstem`, `womeninstem`
- `repo-tt2u`, `repo-tt2u.8`, `srcwave`, `source portfolio`, `wave one`, `identity research`
- `STEM directory`, `STEM communities`, `Black STEM`
- `women in stem`, `black women.*(science|tech|engineer|mathematic)`
- `overlooked Black women`, `exact intended source is unresolved`, `Do not guess a domain`, `Vertical slice D`
- `NSBE`, `SWE`, `AWIS`, `500 Women`, `Black Girls Code`, `National Math and Science`
- `business-science-invention`, `science and technology`
- Git: `--grep="STEM"`, `--grep="Black Women"`, `-S "Black Women in STEM"`, `-S "repo-tt2u"`

---

## Recommended next step (owner)

Provide a short **source identification memo** (can append to this file) with:

1. Exact URL(s) and official name of the intended source  
2. Why this source was chosen (mission fit, licensing, structured access)  
3. Whether content is mostly historical or **current professionals**  
4. Any prior owner research artifacts not yet in the repo  

Until then, `repo-tt2u.8` remains blocked on identification; STEM enrichment should use **already-approved structured authorities** (NASA biographies, ORCID, PatentsView, federal archives) under separate source registrations — not an assumed BWIS domain.
