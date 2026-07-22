<!--
  Chicago metro urban renewal pilot: Renewing Inequality / DSL rights posture, attribute
  inventory, and cite-only public artifact rules for ThemeImpactPacket Q7. Same NC-SA family as HOLC.
-->

# DSL Renewing Inequality Chicago pilot — attribution and rights posture

**Status:** Locked for pilot scaffold (2026-07-22)  
**Pilot scope:** Theme impact question `Q7`, theme `urban_renewal`  
**Companion:** [theme-impact-gap-fill-sources.md](./theme-impact-gap-fill-sources.md), [holc-chicago-pilot-attribution.md](./holc-chicago-pilot-attribution.md)

## 1. Pilot geography

| Field | Value |
|-------|-------|
| Metro scope key | `metro:chicago-il` |
| Cook County FIPS | `17031` |
| Display label | Chicago, Illinois urban renewal projects |
| Attribute window | Federal characteristics reports **1955–1966** |
| Boundary version (project indicators) | `ur-project-vintage-1955-1966` |

County-level Phase 1 indicators (ACS demography, eviction filing rates) load against Cook
County. Urban renewal **project** context references federal characteristics attributes from
Renewing Inequality — not a complete city polygon product.

## 2. Source and rights layers

**Custodian:** University of Richmond Digital Scholarship Lab (Renewing Inequality project)  
**Homepage (public cite target):** https://dsl.richmond.edu/panorama/renewal/  
**GitHub data:** https://github.com/americanpanorama/Renewing_Inequality_Data

| Layer | What it is | License posture |
|-------|------------|-----------------|
| **Federal characteristics reports** | HUD-era urban renewal project attribute tables (1955–1966) | U.S. government works (public domain) |
| **DSL vector derivatives** | Georeferenced project polygons (`ur_projects.geojson`) and compiled attributes | **CC BY-NC-SA 4.0** — attribution required; **noncommercial use only**; share-alike on derivatives |

**Registry id:** `dsl-renewing-inequality`  
**Registry state:** `disabled` (scaffold — parent bead merges registry entry)  
**License verdict:** `noncommercial` in `EXTERNAL_DATA_SOURCES`

Registration is not approval to ingest or ship geometry on public surfaces. The registry entry
documents custodian, homepage, and rights posture only.

### Prohibited for this pilot

- Do **not** scrape or download `ur_projects.geojson` as part of public packet authoring or web
  build steps.
- Do **not** flip `registryState` to `enabled` without a separate rights-review bead.
- Do **not** ship NC GeoJSON polygons, tile layers, or derived displacement choropleths on
  **public or commercial** product surfaces without a completed rights review.

## 3. Chicago inventory (attributes vs polygons)

| Inventory fact | Value |
|----------------|-------|
| Chicago projects with attributes (1955–1966) | **43** |
| Chicago polygon features in `ur_projects.geojson` | **17** (incomplete by city) |
| Pilot fixture projects (curated sample) | **5** (family/dwelling attributes) |

Attribute counts describe **federal report statistics** keyed by `project_id`. Polygon coverage
lags attribute coverage — never label a coarsened or missing polygon as an exact project footprint
on public surfaces.

## 4. Public product rule (cite-only artifacts)

For the urban renewal pilot on `/themes`, story embeds, and map context panels:

1. **Cite the Renewing Inequality homepage** with full DSL attribution in packet `citations` and
   artifact `humanCitation` strings.
2. **Use artifact refs** (`artifactClass: primary_government_document`) — not live GeoJSON layers
   or polygon-derived metrics on anon surfaces.
3. **Keep `method_stance: juxtaposition`** unless a gated causal claim is explicitly cleared.
4. **Label uncertainty** where modern boundaries differ from 1950s–1960s project footprints.

### Required attribution string (public copy)

> Renewing Inequality: Urban Renewal and the American City, Digital Scholarship Lab, University of
> Richmond, https://dsl.richmond.edu/panorama/renewal/. Federal urban renewal characteristics
> reports are U.S. government works. Georeferenced vector data © University of Richmond, licensed
> CC BY-NC-SA 4.0 (noncommercial).

### Example packet artifact shape

Public packets reference a **cite artifact**, not stored geometry:

```json
{
  "artifactId": "art_dsl_renewal_chicago_overview",
  "artifactClass": "cartographic_project_map",
  "title": "Renewing Inequality — Chicago urban renewal projects (cite-only)",
  "dated": "1955-1966",
  "summary": "Federal characteristics attributes for Chicago urban renewal projects; polygon coverage partial.",
  "uncertaintyLabel": "Polygons incomplete by city and NC-SA gated — cite only on public commercial surfaces.",
  "sourceUrl": "https://dsl.richmond.edu/panorama/renewal/"
}
```

Staff-research observation drafts (`surfacePolicy: staff_research`) may store displacement counts
from `non_spatial_data.csv` — they do not authorize public polygon rendering.

## 5. Gate checklist (ingestion + evidence)

| Check | Pilot posture |
|-------|---------------|
| Rights reviewed for public surface | **Cite-only** — NC geometry stays staff-only |
| `dsl-renewing-inequality` registry | Remains `disabled`; verdict `noncommercial` |
| Polygon observations on anon surfaces | **No** — fixtures use citation artifacts only |
| Attribute CSV pilot adapter | Present under `adapters/dsl-renewing-inequality/` |
| Public homepage link | Required in every artifact / citation footer |
| Commercial reuse of DSL GeoJSON | Blocked pending separate rights review |

## 6. References

- [Renewing Inequality — Urban Renewal and the American City](https://dsl.richmond.edu/panorama/renewal/)
- [Renewing Inequality Data (GitHub)](https://github.com/americanpanorama/Renewing_Inequality_Data)
- `packages/domain/src/adapters/dsl-renewing-inequality/` — Chicago pilot adapter
- `packages/firebase/fixtures/reference-indicators/dsl-renewing-inequality-chicago-*` — curated fixtures
