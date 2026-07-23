<!--
  Named secondary consensus bases for systemic_consensus caused/enabled edges
  used by the Chicago-example theme spine (PMC8688641).
-->

# Causal edges (Chicago example spine)

**Status:** Intake review notes for `repo-on9p`  
**Guardrail:** `evaluateCausalEdgeGuardrail` in `packages/domain/src/relationship.ts`  
**Companion:** [theme-impact-pmc8688641-chicago-spine.md](./theme-impact-pmc8688641-chicago-spine.md)

## Allowed systemic_consensus edges

| From (concept / entity) | Type | To (concept / entity) | consensusBasis |
|-------------------------|------|------------------------|----------------|
| Federal HOLC/FHA underwriting system (artifacts + program history) | `enabled` | Durable Black–White residential segregation | Richard Rothstein, *The Color of Law* (2017); Douglas S. Massey and Nancy A. Denton, *American Apartheid* (1993); Banaji, Fiske & Massey (2021) institutional section |
| Residential hypersegregation | `enabled` | Unequal school opportunity (resource + isolation channel) | Massey & Tannen (2016); Owens (2020); Banaji, Fiske & Massey (2021) |
| Jim Crow franchise devices + collapsed Reconstruction enforcement | `enabled` | Black political exclusion until federal Voting Rights Act tools | Foner (1990); Voting Rights Act of 1965 primary text; Banaji, Fiske & Massey (2021) |

## Packet claim ids (public theme-impact)

| claimId | Used on |
|---------|---------|
| `claim_systemic_fha_holc_enabled_segregation_rothstein_2017` | Redlining Q1 |
| `claim_systemic_segregation_linchpin_banaji_fiske_massey_2021` | Redlining Q1 (also on Banaji artifact) |

## Explicitly rejected as caused/enabled

- HOLC map polygon alone → every later Cook County ACS gap (contested; Hillier 2003; keep juxtaposition on Q2–Q4)
- Chicago Race Riot of 1919 → federal FHA manual text (sequence is historical context, not a direct enabling edge)
- Any single realtor / single eviction → systemic outcome (route through `cites`)

## Entity graph apply

Live `caused`/`enabled` rows require operator intake with the `consensusBasis` strings above. Theme packets may publish `gated_causal_claim` once claim ids are present; that does not auto-write graph edges.
