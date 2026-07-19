/**
 * Shared helpers for national-story fact drafts: revision metadata, confidence
 * scoring, and confirmed Wayback citation fields.
 */

export const ACCESSED_AT = '2026-07-19T00:00:00.000Z';
export const NATIONAL_SEED_RELEASE_ID = 'seed-snapshot';
export const NATIONAL_SEED_GENERATED_AT = '2026-07-17T00:00:00.000Z';

export type RevisionMetadata = {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly recordUpdatedAt: string;
};

export function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

export function revisionFor(recordUpdatedAt: string): RevisionMetadata {
  return {
    releaseId: NATIONAL_SEED_RELEASE_ID,
    generatedAt: NATIONAL_SEED_GENERATED_AT,
    recordUpdatedAt,
  };
}

export function mapPinFromGeo(
  lat: number,
  lng: number,
): { readonly x: number; readonly y: number } {
  return {
    x: Math.min(1, Math.max(0, (lng + 125) / 60)),
    y: Math.min(1, Math.max(0, (50 - lat) / 25)),
  };
}

const NOTABILITY_COPY: Readonly<Record<string, string>> = {
  only_or_oldest:
    'The entity is the only known, or the oldest surviving, instance of a historically significant type with documentary evidence.',
  landmark_or_national_register:
    'The entity carries a documented landmark or National Register designation with a citable authority record.',
  documented_site:
    'The entity is a documented site of a historically significant event or practice with primary-source evidence tying the site to the event.',
  first_to_do_x:
    'The entity is documented as the first of its kind to accomplish a historically significant milestone.',
  community_anchor:
    'The entity served as a long-standing, evidenced community anchor institution with a documented multi-decade role in a specific community.',
  movement_significance:
    'The entity is documented as central to a historically significant movement with citable organizational or place evidence.',
};

export function notabilityLabel(criterion: keyof typeof NOTABILITY_COPY): readonly string[] {
  return [NOTABILITY_COPY[criterion]!];
}

/** Confirmed Wayback captures — keys must match live citation URLs exactly. */
export const CONFIRMED_WAYBACK: Readonly<
  Record<string, { readonly archivedUrl: string; readonly archivedAt: string }>
> = {
  'https://explorepahistory.com/hmarker.php?markerId=1135': {
    archivedUrl:
      'https://web.archive.org/web/20110218164144/http://explorepahistory.com/hmarker.php?markerId=1135',
    archivedAt: '2011-02-18T16:41:44.000Z',
  },
  'https://www.lincoln.edu/about/history.html': {
    archivedUrl: 'https://web.archive.org/web/20190531043729/http://www.lincoln.edu/about/history',
    archivedAt: '2019-05-31T04:37:29.000Z',
  },
  'https://www2.howard.edu/about/history': {
    archivedUrl: 'https://web.archive.org/web/20190502190931/https://www2.howard.edu/about/history',
    archivedAt: '2019-05-02T19:09:31.000Z',
  },
  'https://siarchives.si.edu/history/national-museum-african-american-history-and-culture': {
    archivedUrl:
      'https://web.archive.org/web/20190312005930/https://siarchives.si.edu/history/national-museum-african-american-history-and-culture',
    archivedAt: '2019-03-12T00:59:30.000Z',
  },
  'https://nmaahc.si.edu/explore/stories/education-steeped-african-american-culture-historically-black-colleges-and':
    {
      archivedUrl:
        'https://web.archive.org/web/20240907030444/https://nmaahc.si.edu/explore/stories/education-steeped-african-american-culture-historically-black-colleges-and',
      archivedAt: '2024-09-07T03:04:44.000Z',
    },
  'http://www.nps.gov/archive/casa/home/ftmose.htm': {
    archivedUrl:
      'https://web.archive.org/web/20080405200938/http://www.nps.gov/archive/casa/home/ftmose.htm',
    archivedAt: '2008-04-05T20:09:38.000Z',
  },
  'http://digital.library.okstate.edu/encyclopedia/entries/B/BO008.html': {
    archivedUrl:
      'https://web.archive.org/web/20090307195745/http://digital.library.okstate.edu/encyclopedia/entries/B/BO008.html',
    archivedAt: '2009-03-07T19:57:45.000Z',
  },
  'http://www.aaregistry.com/african_american_history/2054/Boley_Oklahoma_a_FUBU_of_towns': {
    archivedUrl:
      'https://web.archive.org/web/20060115190447/http://www.aaregistry.com/african_american_history/2054/Boley_Oklahoma_a_FUBU_of_towns',
    archivedAt: '2006-01-15T19:04:47.000Z',
  },
  'http://nypl.org/research/sc/sc.html': {
    archivedUrl: 'https://web.archive.org/web/20090207083811/http://nypl.org/research/sc/sc.html',
    archivedAt: '2009-02-07T08:38:11.000Z',
  },
  'http://www.motownmuseum.com/mtmpages/index.html': {
    archivedUrl:
      'https://web.archive.org/web/20080818083104/http://www.motownmuseum.com/mtmpages/index.html',
    archivedAt: '2008-08-18T08:31:04.000Z',
  },
  'https://www.nps.gov/people/harriet-tubman.htm': {
    archivedUrl:
      'https://web.archive.org/web/20250128122533/https://www.nps.gov/people/harriet-tubman.htm',
    archivedAt: '2025-01-28T12:25:33.000Z',
  },
  'https://www.nps.gov/aboutus/recent-changes.htm': {
    archivedUrl:
      'https://web.archive.org/web/20220308124009/https://www.nps.gov/aboutus/recent-changes.htm',
    archivedAt: '2022-03-08T12:40:09.000Z',
  },
  'http://www.virginiamemory.com/': {
    archivedUrl: 'https://web.archive.org/web/20210511181139/http://www.virginiamemory.com/',
    archivedAt: '2021-05-11T18:11:39.000Z',
  },
  'https://armyhistory.org/the-black-immune-regiments-in-the-spanish-american-war/': {
    archivedUrl:
      'https://web.archive.org/web/20151018025024/https://armyhistory.org/the-black-immune-regiments-in-the-spanish-american-war/',
    archivedAt: '2015-10-18T02:50:24.000Z',
  },
  'http://www.jbhe.com/timeline.html': {
    archivedUrl: 'https://web.archive.org/web/20121031101217/http://www.jbhe.com/timeline.html',
    archivedAt: '2012-10-31T10:12:17.000Z',
  },
  'http://www.csrmf.org/doc.asp?id=280': {
    archivedUrl: 'https://web.archive.org/web/20050330200926/http://www.csrmf.org/doc.asp?id=280',
    archivedAt: '2005-03-30T20:09:26.000Z',
  },
  'http://www.centralhigh57.org/1957-58.htm': {
    archivedUrl:
      'https://web.archive.org/web/20061217140900/http://www.centralhigh57.org/1957-58.htm',
    archivedAt: '2006-12-17T14:09:00.000Z',
  },
};

export function webCitation(
  liveUrl: string,
  csl: {
    readonly id: string;
    readonly type: string;
    readonly title: string;
    readonly publisher?: string;
    readonly URL: string;
  },
  excerpt: string,
  sourceClass: 'primary' | 'secondary' | 'tertiary' = 'secondary',
): {
  readonly csl: typeof csl;
  readonly sourceClass: typeof sourceClass;
  readonly role: 'supports';
  readonly excerpt: string;
  readonly archivedUrl: string;
  readonly archivedAt: string;
  readonly accessedAt: string;
} {
  const capture = CONFIRMED_WAYBACK[liveUrl];
  if (!capture) {
    throw new Error(`Missing confirmed Wayback capture for ${liveUrl}`);
  }
  return {
    csl,
    sourceClass,
    role: 'supports',
    excerpt,
    archivedUrl: capture.archivedUrl,
    archivedAt: capture.archivedAt,
    accessedAt: ACCESSED_AT,
  };
}

export function printCitation(
  csl: {
    readonly id: string;
    readonly type: string;
    readonly title: string;
    readonly author?: readonly { readonly family?: string; readonly given?: string }[];
    readonly issued?: { readonly 'date-parts'?: readonly (readonly number[])[] };
    readonly 'container-title'?: string;
    readonly publisher?: string;
  },
  excerpt: string,
  sourceNote?: string,
): {
  readonly csl: typeof csl;
  readonly sourceClass: 'primary' | 'secondary';
  readonly role: 'supports';
  readonly excerpt: string;
  readonly accessedAt: string;
  readonly sourceNote?: string;
} {
  return {
    csl,
    sourceClass: 'primary',
    role: 'supports',
    excerpt,
    accessedAt: ACCESSED_AT,
    ...(sourceNote !== undefined ? { sourceNote } : {}),
  };
}

export function seedRevision(summary: string) {
  return [
    {
      revisionNumber: 1,
      timestamp: '2026-07-19T00:00:00.000Z',
      agent: {
        id: 'national-story-seed',
        type: 'system' as const,
        displayName: 'National story seed',
      },
      changeType: 'update' as const,
      summary,
      diff: [],
    },
  ];
}
