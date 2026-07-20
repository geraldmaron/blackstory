/**
 * Curated “Did you know” framings for `/history`: obscure, evidence-first facts with
 * named sources and stable URLs. Not trivia — archive-grade claims only. Rotate by
 * seed so the panel stays deterministic for tests while still varying by day.
 */
export type HistoryDidYouKnowSource = {
  readonly label: string;
  readonly url: string;
};

export type HistoryDidYouKnowFact = {
  readonly id: string;
  /** Short archival framing — evidence before assertion. */
  readonly statement: string;
  readonly sources: readonly HistoryDidYouKnowSource[];
  /** Optional catalog entity to deep-link when present in the live release. */
  readonly relatedEntityId?: string;
};

/**
 * Validated candidates (2026-07-20). Prefer NPS / state parks / NARA / LOC / university
 * public history over tertiary summaries. Wikipedia is never a source here.
 */
export const HISTORY_DID_YOU_KNOW_FACTS: readonly HistoryDidYouKnowFact[] = [
  {
    id: 'dyk-fort-mose-1738',
    statement:
      'In 1738, Spanish Florida chartered Gracia Real de Santa Teresa de Mose (Fort Mose) north of St. Augustine — the first legally sanctioned free Black settlement in what is now the United States. Freedom required allegiance to Spain and Catholic baptism; roughly one hundred people built a frontier community there.',
    sources: [
      {
        label: 'Florida State Parks — History of Fort Mose',
        url: 'https://www.floridastateparks.org/learn/history-fort-mose',
      },
      {
        label: 'National Park Service — Fort Mose (Fort Matanzas NM)',
        url: 'https://www.nps.gov/foma/learn/historyculture/fort-mose.htm',
      },
    ],
  },
  {
    id: 'dyk-dunbar-1870-basement',
    statement:
      'America’s first public high school for African American students began in 1870 as the Preparatory High School for Colored Youth — not in a dedicated campus, but in the basement of Fifteenth Street Presbyterian Church in Washington, D.C. The school later became M Street High School, then Paul Laurence Dunbar High School.',
    sources: [
      {
        label: 'DC Historic Sites — Paul Laurence Dunbar High School',
        url: 'https://historicsites.dcpreservation.org/items/show/162',
      },
      {
        label: 'Britannica — Dunbar High School (Washington, D.C.)',
        url: 'https://www.britannica.com/topic/Dunbar-High-School-Washington-D-C',
      },
    ],
    relatedEntityId: 'ent_dunbar_school_001',
  },
  {
    id: 'dyk-buffalo-soldiers-parks',
    statement:
      'Before the National Park Service existed (1916), the U.S. Army administered Yosemite and Sequoia. Buffalo Soldiers of the 24th Infantry and 9th Cavalry — African American regiments — patrolled those parks in 1899, 1903, and 1904, doing work we now call ranger duty: trails, fires, anti-poaching, and visitor order.',
    sources: [
      {
        label: 'National Park Service — Buffalo Soldiers (Yosemite)',
        url: 'https://www.nps.gov/yose/learn/historyculture/buffalo-soldiers.htm',
      },
      {
        label: 'National Park Service — Buffalo Soldiers overview',
        url: 'https://www.nps.gov/articles/buffalo-soldiers.htm',
      },
    ],
  },
  {
    id: 'dyk-charles-young-sequoia-1903',
    statement:
      'In summer 1903, Captain Charles Young of the 9th Cavalry served as acting superintendent of Sequoia National Park — the first African American to hold that post for a U.S. national park — while his troops built road mileage that opened the Giant Forest to public travel.',
    sources: [
      {
        label: 'National Park Service — Buffalo Soldiers (Yosemite context on Young)',
        url: 'https://www.nps.gov/yose/learn/historyculture/buffalo-soldiers.htm',
      },
      {
        label: 'National Park Service — Buffalo Soldiers park articles hub',
        url: 'https://www.nps.gov/articles/buffalo-soldiers.htm',
      },
    ],
  },
  {
    id: 'dyk-allensworth-1908',
    statement:
      'Allensworth, in California’s San Joaquin Valley, was founded in 1908 by Colonel Allen Allensworth and co-founders as the only California town financed, founded, and governed by African Americans. The townsite is preserved today as Colonel Allensworth State Historic Park.',
    sources: [
      {
        label: 'California State Parks — Colonel Allensworth SHP',
        url: 'https://www.parks.ca.gov/?page_id=583',
      },
      {
        label: 'California Office of Historic Preservation — Allensworth Historic Town Site',
        url: 'https://ohp.parks.ca.gov/ListedResources/Detail/1047',
      },
    ],
  },
  {
    id: 'dyk-free-african-society-1787',
    statement:
      'On 12 April 1787, Absalom Jones and Richard Allen organized the Free African Society in Philadelphia — a mutual-aid society funded by member subscriptions for burial, widows, apprenticeships, and schooling. During the 1793 yellow fever epidemic, members nursed the sick and buried the dead while much of the city’s elite fled.',
    sources: [
      {
        label: 'National Park Service — Free African Society articles of association',
        url: 'https://www.nps.gov/articles/000/inde-preamble-and-articles-of-association-for-the-free-african-society.htm',
      },
      {
        label: 'Encyclopedia of Greater Philadelphia — Free African Society',
        url: 'https://philadelphiaencyclopedia.org/essays/free-african-society/',
      },
    ],
  },
  {
    id: 'dyk-emancipation-limits-1863',
    statement:
      'The Emancipation Proclamation (1 January 1863) freed enslaved people only in states “in rebellion,” explicitly exempting Union-loyal border states and Confederate areas already under Union control — a wartime decree whose reach was narrower than its later popular memory.',
    sources: [
      {
        label: 'National Archives — Emancipation Proclamation (1863)',
        url: 'https://www.archives.gov/milestone-documents/emancipation-proclamation',
      },
      {
        label: 'Library of Congress — Emancipation Proclamation research guide',
        url: 'https://guides.loc.gov/emancipation-proclamation',
      },
    ],
  },
  {
    id: 'dyk-vra-mississippi-registration',
    statement:
      'Within a few years of the Voting Rights Act of 1965, Black voter registration in Mississippi rose from about 6 percent to about 44 percent — a measurable shift after federal preclearance and examiners dismantled devices that had blocked the Fifteenth Amendment in practice.',
    sources: [
      {
        label: 'National Archives — Voting Rights Act (1965)',
        url: 'https://www.archives.gov/milestone-documents/voting-rights-act',
      },
      {
        label: 'U.S. Department of Justice — History of federal voting rights laws',
        url: 'https://www.justice.gov/crt/history-federal-voting-rights-laws',
      },
    ],
  },
];

/** Deterministic pick for SSR/tests — stable for a given seed. */
export function selectDidYouKnowFacts(
  count: number,
  seed = 1,
  catalog: readonly HistoryDidYouKnowFact[] = HISTORY_DID_YOU_KNOW_FACTS,
): readonly HistoryDidYouKnowFact[] {
  if (catalog.length === 0 || count <= 0) return [];
  const take = Math.min(count, catalog.length);
  const start = Math.abs(seed) % catalog.length;
  const out: HistoryDidYouKnowFact[] = [];
  for (let i = 0; i < take; i += 1) {
    out.push(catalog[(start + i) % catalog.length]!);
  }
  return out;
}
