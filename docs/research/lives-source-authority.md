<!--
  What counts as a source for a Lives Across the Decades figure, and why the line sits where it does.
  Decision record for the 2026-09-15 widening from "Census Bureau" to "federal statistical", and for
  what stayed outside. Binding method: docs/methodology/lives-across-decades.md.
-->

# Lives: what counts as a source

**Status:** Decision record
**Date:** 2026-09-15
**Related:** [lives-across-decades.md](../methodology/lives-across-decades.md),
[lives-nhgis-table-map.md](./lives-nhgis-table-map.md)

The timeline has eleven decades with holes in them. The question this record settles is which sources
may fill them.

## The decision

**In: any published federal statistical table.** Widened on 2026-09-15 from "Census Bureau" by owner
decision, on the principle that a source reasonably considered reputable should be used. The bar is the
one a census volume already clears:

1. an identified federal agency published it,
2. it is a table, not a narrative assertion,
3. the cells are counts the agency collected, not estimates it modeled,
4. a reader can open the page and check the number, and
5. it is crossed by race at state or national level.

Cite the issuing agency's own publication. A scholarly book that reprints a bulletin may be the finding
aid that led there, and should be thanked in the note, but the bulletin is the source.

**Out: scholarly reconstructions, as figures.** Not for lack of reputability. Collins and Margo are
among the most cited economic historians working on exactly these questions, and their series are
careful and peer-reviewed. They stay out for three reasons that have nothing to do with who wrote them.

**Geography, which breaks first and breaks silently.** Nothing on offer is state level. This timeline
stores states and sums them into six regions, and the sum is the check that every ingested figure is
validated against. A national homeownership rate dropped into the Deep South cell is wrong, not
approximate. Put only in the national baseline, it creates a national row that the six regions summing
to it cannot reproduce, which reads as a bug and disables the one validation the pipeline has.

**Universe, which breaks invisibly.** Collins and Margo's headline series counts male household heads
aged 25-64, in the labor force and not in school. The census tenure tables beside it count all
households, and 1940's count occupants rather than householders. Put those in one column and the line
moves when the definition moves, which is the precise failure the rule against computing a change
across two definitions exists to prevent.

**Provenance, which breaks the promise.** The timeline's claim is strong and simple: every number here
is a count somebody published, and you can go and check it. A figure that is five inferential steps deep
cannot be checked that way, and a reader cannot tell it apart from one that can.

## What the search actually found

Reading the scholarship's citations turned out to be worth more than its estimates. Every series
examined was either a national or regional aggregate built from IPUMS microdata — which this project
decided not to use, and which a citation does not launder — or state level but transcribing published
government tables the project can transcribe itself. Not one was state level, crossed by race, and built
on something other than microdata.

So the scholarship's role here is as a finding aid, and a good one. It led to
*Negro Population in the United States, 1790-1915* (Census Bureau, 1918), which carries urban and rural
residence by state for 1890, 1900 and 1910; home ownership by state for the same three; and the full
occupational classification by state for 1910. Those are Tier A tables that needed no decision at all.
It also led to the Bureau and Office of Education bulletins behind Margo's schooling tables, which the
widening above admits directly.

## The one case worth revisiting

If a scholarly series ever appears that is **state level, race-crossed, and built from published tables
rather than microdata**, the geography and provenance objections both fall and only the universe
question remains, which a count note can carry. Nothing found so far meets that description. Revisit
this record rather than assume it was settled forever.

## A disagreement to keep, not resolve

The 1918 monograph and the 1896 Holmes and Lord report disagree on the 1890 home ownership count:
18.7 percent against 17.5 percent, unexplained by the 1918 text. Two independent transcriptions will
surface this. It is a real disagreement between two published federal sources and belongs in the record
as one, with both figures kept. It is not an error to average away.
