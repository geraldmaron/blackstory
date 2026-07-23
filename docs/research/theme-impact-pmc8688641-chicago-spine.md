<!--
  Research spine mapping Banaji, Fiske & Massey (2021) systemic-racism tutorial
  onto BlackStory theme-impact packets. Chicago is an example metro, not exclusive coverage.
-->

# Theme-impact spine from PMC8688641 (Chicago example)

**Status:** Binding research for `repo-on9p` (2026-07-23)  
**Source:** Mahzarin R. Banaji, Susan T. Fiske, and Douglas S. Massey, “Systemic racism: individuals and interactions, institutions and society,” *Cognitive Research: Principles and Implications* 6:82 (2021), doi:10.1186/s41235-021-00349-3, [PMC8688641](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8688641/).  
**License note:** CC BY 4.0 (Springer/PMC). Cite; do not treat the tutorial as a primary archival source for map polygons or loan microdata.  
**Companions:** [theme-impact-canonical-questions.md](./theme-impact-canonical-questions.md), [juxtaposition-not-causation.md](../methodology/juxtaposition-not-causation.md), ADR-029.

## 1. Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Shape | Deepen housing/redlining as the systemic housing-credit spine (theme id stays `redlining` for URL stability) |
| Geography | Chicago / Cook County as an **example** reading of a national pattern |
| Causation | `gated_causal_claim` only with named secondary consensus bases |
| Next domains | Education, then voting / political exclusion |
| Voice | Human story that links artifacts → place → later indicators |

## 2. Institutional chain in the paper (what we validate)

Banaji/Fiske/Massey argue residential segregation is the linchpin that transmits disadvantage into schools, networks, wealth, health, and legal treatment. The historical section (Massey’s synthesis) runs:

1. Great Migration urbanization → White neighborhood associations, sundown towns, racial zoning  
2. Private covenants; Chicago Real Estate Board model covenant (1927)  
3. Violence as enforcement (Chicago Race Riot of 1919; Tulsa 1921)  
4. HOLC Residential Security Maps + FHA Underwriting Manual race/neighborhood rules  
5. Postwar suburbanization with federally insured White homeownership  
6. Urban renewal / public housing concentrating poverty  
7. Persistence of segregation after Fair Housing / ECOA / CRA  

Chicago appears explicitly (1919 riot; Real Estate Board covenants; blockbusting; urban renewal). That makes Chicago a strong **example**, not a claim that the system was only local.

## 3. Named secondary bases for causal edges

| Edge (systemic_consensus) | Consensus basis (named) | Packet use |
|---------------------------|-------------------------|------------|
| Federal HOLC/FHA underwriting system **enabled** durable residential segregation | Rothstein, *The Color of Law* (2017); Massey & Denton, *American Apartheid* (1993); Banaji, Fiske & Massey (2021) institutional section | Redlining Q1 `gated_causal_claim` |
| Residential hypersegregation **enabled** school segregation and unequal school resources | Massey & Tannen (2016); Owens (2020); Banaji et al. (2021) | Education Q11 method note + cites (juxtaposition until school-finance series load) |
| Jim Crow franchise devices **enabled** Black political exclusion until federal enforcement | Foner (1990); Voting Rights Act primary text; Banaji et al. Reconstruction/Jim Crow framing | Voting Q12 artifact spine |

Contested or single-incident claims (e.g. a specific realtor “caused” a specific eviction) stay on `cites`, never `caused`/`enabled`.

## 4. Packet map

| Theme id | Question | Story beat | Chicago example assets |
|----------|----------|------------|------------------------|
| `redlining` | Q1–Q4 | Housing credit system → place → later indicators | HOLC inventory; Bronzeville; Cook ACS/HMDA/CHAS/NHGIS; 1919 riot entity |
| `school_segregation` | Q11 | Segregated housing → school opportunity → attainment | Cook BA attainment + Banaji/Massey school-segregation cites; Brown artifact |
| `voting_rights` | Q12 | Franchise suppression → federal remedy → incomplete enforcement | 15th Amendment + VRA entities; national spine with Chicago northern-city framing |

Existing P0/P1 themes (drug policy, urban renewal, mass incarceration, environmental) remain; urban renewal continues the Massey displacement chapter.

## 5. Entity bindings (existing + story roles)

| Entity id | Role in spine |
|-----------|---------------|
| `ent_bronzeville_001` | Place narrative for redlining Q4 |
| `ent_chicago_race_riot_1919_001` | Violence-as-enforcement beat on housing Q1 |
| `ent_law_voting_rights_act_1965` | Voting Q12 primary statute |
| `ent_law_15th_amendment_1870` | Voting Q12 Reconstruction franchise promise |
| `ent_chicago_freedom_movement_001` | Education / open-housing crosslink (story cite) |

New catalog entities are opened only when no existing match covers the beat (Real Estate Board covenant practice may remain artifact-cited until a dedicated org entity is curated).

## 6. Evidence gaps kept explicit

- HOLC population-by-grade for Chicago (Q2)  
- Tract-level linkage of Bronzeville households to HOLC polygons (Q4)  
- CRDC / SEDA school metrics (education; cite-first until ingest bead)  
- MIT Election Lab / Voting Rights Lab turnout & policy indicators (voting; cite-first)  
- Mapping Inequality polygons remain cite-only on commercial surfaces (CC BY-NC-SA)

## 7. Example framing copy (required)

Public ledes and geography labels must say the Chicago/Cook reading is an **example** of a national pattern described in Banaji/Fiske/Massey and the named housing histories. Do not imply the warehouse covers every U.S. metro.

## 8. Acceptance

- [x] Source inventory mapped to themes/questions  
- [x] Named secondary bases listed for causal edges  
- [x] Chicago-as-example rule stated  
- [x] Packets, catalog, storytelling, and tests updated in code (same change set)
