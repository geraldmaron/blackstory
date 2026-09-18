<!--
  Binding map from published census occupation (or class-of-worker) stubs to Lives work-class
  buckets for 1870–1930. Figures stay transcribed counts; this file only names how stubs roll up.
-->

# Lives work-class buckets from published occupation stubs

**Status:** Binding for transcription (2026-09-16)
**Related:** [lives-across-decades.md](../methodology/lives-across-decades.md), bead repo-0clax.40

Published volumes print major occupation classes by race. Lives stores four work-class series via
`workClassSeriesId`: `lower`, `middle`, `upper`, and `unclassified`. Until a decade's stubs are
transcribed, class shares stay `pending`.

## Buckets (domain code)

| Lives bucket | Series id | Published stubs that roll into it (1890–1900 wording) |
|---|---|---|
| `upper` | `lives-class-work-upper` | Professional service |
| `middle` | `lives-class-work-middle` | Trade and transportation; Manufacturing and mechanical industries / pursuits |
| `lower` | `lives-class-work-lower` | Agriculture, fisheries, and mining / Agricultural pursuits; Domestic and personal service |
| `unclassified` | `lives-class-work-unclassified` | Only when the volume prints a residual that is not one of the classes above |

Exact stub labels differ by decade (1910–1930 add Clerical, Public service, Extraction of minerals).
A transcription pass records the printed stub name in metadata and assigns it to one bucket above.
Do not invent a fifth reader-facing tier. Do not map OCC1950 microdata codes into these cells.

**1890 / 1900 roll-up (national first):** sum the published class counts into the three buckets, then
store each bucket's numerator over the printed "All occupations" / gainful total for that race (and
sex when Table 34 / Table 5 is used for the woman unit).

## Decade notes

- **1870–1880:** Published race×occupation tables are absent; leave `not_measured`.
- **1890:** Special Census Report on Occupations, Table 4 (states) / national companion; Table 5 adds sex.
- **1900:** Occupations at the Twelfth Census, Table 34 (sex × nativity × color by state); national first.
- **Never** average white native-born and foreign-born into a white figure unless the volume already
  prints a Total white line. Never residualize White from Total−Negro.
