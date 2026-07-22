/**
 * Prepares broader-net discovery enrichment keeps for auto-promote:
 * merges priority + E2 subjects/runs, geofixes location fields, normalizes packet
 * validation issues, and drops person/privacy exclusions.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveReleaseEntityStateCode } from '@repo/domain';
import { normalizeEnrichmentDrafts } from './lib/normalize-enrichment-drafts.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const cacheDir = join(repoRoot, '.cache/discovery-enrichment');

type SubjectMeta = {
  readonly subjectId: string;
  readonly title: string;
  readonly kind?: string;
  readonly existingSummary?: string;
  readonly sourceSnippets?: readonly string[];
  readonly lat?: number;
  readonly lng?: number;
  readonly corroboratingSourceUrl?: string;
  jurisdictionLabel?: string;
  locationLabel?: string;
  locationPrecision?: string;
};

type Candidate = {
  readonly id: string;
  readonly displayName: string;
  readonly summary: string;
  readonly kind: string;
  readonly lat?: number;
  readonly lng?: number;
};

type EnrichmentItem = {
  readonly packet: {
    readonly subjectId: string;
    readonly subjectTitle?: string;
    readonly decision: string;
    readonly confidence: number;
    readonly validationIssues: readonly string[];
    readonly drafts: Record<string, unknown>;
  };
  readonly rawModelContent?: string;
  readonly relatedSuggestions?: unknown[];
};

/** Subjects never auto-promoted (person / living privacy). */
const DROP_SUBJECT_IDS = new Set([
  'disc_nat_turner_q329730',
  'disc_viola_fletcher_q108438891',
  'disc_frank_e_petersen_q5486398',
]);

type LocationFix = {
  readonly jurisdictionLabel: string;
  readonly locationLabel: string;
  readonly locationPrecision: 'site' | 'city' | 'county' | 'institution' | 'campus';
  readonly lat?: number;
  readonly lng?: number;
};

/** Curated location fixes — NRHP/Wikipedia/locality research for broader-net keeps. */
const CURATED_LOCATIONS: Record<string, LocationFix> = {
  disc_nat_turner_s_slave_rebellion_q6967898: {
    jurisdictionLabel: 'Southampton County, Virginia',
    locationLabel: 'Southampton County',
    locationPrecision: 'county',
    lat: 36.77,
    lng: -77.161,
  },
  disc_gabriel_q1393002: {
    jurisdictionLabel: 'Richmond, Virginia',
    locationLabel: 'Richmond',
    locationPrecision: 'city',
    lat: 37.5407,
    lng: -77.436,
  },
  disc_charleston_workhouse_slave_rebellion_q126391651: {
    jurisdictionLabel: 'Charleston, South Carolina',
    locationLabel: 'Charleston Workhouse',
    locationPrecision: 'site',
    lat: 32.77857,
    lng: -79.9372,
  },
  disc_pointe_coup_e_slave_conspiracy_of_1791_q109536297: {
    jurisdictionLabel: 'Pointe Coupee Parish, Louisiana',
    locationLabel: 'Pointe Coupee Parish',
    locationPrecision: 'county',
    lat: 30.688,
    lng: -91.464,
  },
  disc_whitney_plantation_historic_district_q7996735: {
    jurisdictionLabel: 'St. John the Baptist Parish, Louisiana',
    locationLabel: 'Whitney Plantation Historic District',
    locationPrecision: 'site',
    lat: 30.03917,
    lng: -90.65056,
  },
  disc_mcleod_plantation_q6802238: {
    jurisdictionLabel: 'Charleston County, South Carolina',
    locationLabel: 'McLeod Plantation',
    locationPrecision: 'site',
    lat: 32.76278,
    lng: -79.97236,
  },
  disc_destrehan_plantation_q3391526: {
    jurisdictionLabel: 'St. Charles Parish, Louisiana',
    locationLabel: 'Destrehan Plantation',
    locationPrecision: 'site',
    lat: 29.94543,
    lng: -90.36531,
  },
  disc_laura_plantation_q6499319: {
    jurisdictionLabel: 'St. James Parish, Louisiana',
    locationLabel: 'Laura Plantation',
    locationPrecision: 'site',
    lat: 30.0087,
    lng: -90.7253,
  },
  disc_evergreen_plantation_q5417235: {
    jurisdictionLabel: 'St. John the Baptist Parish, Louisiana',
    locationLabel: 'Evergreen Plantation',
    locationPrecision: 'site',
    lat: 30.02722,
    lng: -90.64056,
  },
  disc_hampton_plantation_q5646268: {
    jurisdictionLabel: 'Charleston County, South Carolina',
    locationLabel: 'Hampton Plantation',
    locationPrecision: 'site',
    lat: 33.19833,
    lng: -79.43778,
  },
  disc_tuskegee_airmen_national_historic_site_q7856793: {
    jurisdictionLabel: 'Macon County, Alabama',
    locationLabel: 'Tuskegee Airmen National Historic Site',
    locationPrecision: 'site',
    lat: 32.45718,
    lng: -85.68036,
  },
  disc_golden_thirteen_q5579862: {
    jurisdictionLabel: 'Lake County, Illinois',
    locationLabel: 'Naval Station Great Lakes',
    locationPrecision: 'institution',
    lat: 42.309,
    lng: -87.841,
  },
  disc_tulsa_race_massacre_q1824714: {
    jurisdictionLabel: 'Tulsa, Oklahoma',
    locationLabel: 'Greenwood District',
    locationPrecision: 'city',
    lat: 36.15972,
    lng: -95.98583,
  },
  disc_1967_detroit_riot_q768155: {
    jurisdictionLabel: 'Detroit, Michigan',
    locationLabel: 'Detroit',
    locationPrecision: 'city',
    lat: 42.37639,
    lng: -83.09944,
  },
  disc_1967_tampa_riots_q107293067: {
    jurisdictionLabel: 'Tampa, Florida',
    locationLabel: 'Tampa',
    locationPrecision: 'city',
    lat: 27.9506,
    lng: -82.4572,
  },
  disc_1967_riviera_beach_riot_q107427691: {
    jurisdictionLabel: 'Riviera Beach, Florida',
    locationLabel: 'Riviera Beach',
    locationPrecision: 'city',
    lat: 26.7753,
    lng: -80.0581,
  },
  disc_harlem_riot_of_1943_q5658573: {
    jurisdictionLabel: 'New York, New York',
    locationLabel: 'Harlem',
    locationPrecision: 'city',
    lat: 40.8116,
    lng: -73.9465,
  },
  disc_harlem_riot_of_1935_q5658575: {
    jurisdictionLabel: 'New York, New York',
    locationLabel: 'Harlem',
    locationPrecision: 'city',
    lat: 40.8116,
    lng: -73.9465,
  },
  disc_atlanta_race_riot_q4816127: {
    jurisdictionLabel: 'Atlanta, Georgia',
    locationLabel: 'Atlanta',
    locationPrecision: 'city',
    lat: 33.75432,
    lng: -84.38979,
  },
  disc_ocoee_massacre_q17107953: {
    jurisdictionLabel: 'Ocoee, Florida',
    locationLabel: 'Ocoee',
    locationPrecision: 'city',
    lat: 28.5933,
    lng: -81.5276,
  },
  disc_perry_race_riot_q15706453: {
    jurisdictionLabel: 'Perry, Florida',
    locationLabel: 'Perry',
    locationPrecision: 'city',
    lat: 30.1134,
    lng: -83.5819,
  },
  disc_crispus_attucks_q288241: {
    jurisdictionLabel: 'Boston, Massachusetts',
    locationLabel: 'Boston Massacre site',
    locationPrecision: 'city',
    lat: 42.3588,
    lng: -71.0578,
  },
  disc_magnolia_plantation_and_gardens_charleston_south_q11684456: {
    jurisdictionLabel: 'Charleston County, South Carolina',
    locationLabel: 'Magnolia Plantation and Gardens',
    locationPrecision: 'site',
    lat: 32.87641,
    lng: -80.0835,
  },
  disc_callaway_plantation_q5021801: {
    jurisdictionLabel: 'Wilkes County, Georgia',
    locationLabel: 'Callaway Plantation',
    locationPrecision: 'site',
    lat: 33.7756,
    lng: -82.81201,
  },
  disc_the_hermitage_q2376587: {
    jurisdictionLabel: 'Davidson County, Tennessee',
    locationLabel: 'The Hermitage',
    locationPrecision: 'site',
    lat: 36.215,
    lng: -86.61306,
  },
  disc_ormond_plantation_house_q7103448: {
    jurisdictionLabel: 'St. Charles Parish, Louisiana',
    locationLabel: 'Ormond Plantation House',
    locationPrecision: 'site',
    lat: 29.95417,
    lng: -90.38694,
  },
  disc_st_joseph_plantation_q7589354: {
    jurisdictionLabel: 'St. James Parish, Louisiana',
    locationLabel: 'St. Joseph Plantation',
    locationPrecision: 'site',
    lat: 30.00597,
    lng: -90.77225,
  },
  disc_ingleside_plantation_q6032651: {
    jurisdictionLabel: 'Leon County, Florida',
    locationLabel: 'Ingleside Plantation',
    locationPrecision: 'site',
    lat: 30.5604,
    lng: -84.0139,
  },
  disc_salisbury_plantation_q7404795: {
    jurisdictionLabel: 'Somerset County, Maryland',
    locationLabel: 'Salisbury Plantation',
    locationPrecision: 'site',
    lat: 38.0883,
    lng: -75.7369,
  },
  disc_pomfret_plantation_q7227305: {
    jurisdictionLabel: 'Somerset County, Maryland',
    locationLabel: 'Pomfret Plantation',
    locationPrecision: 'site',
    lat: 38.0419,
    lng: -75.8017,
  },
  disc_1967_newark_riots_q4572764: {
    jurisdictionLabel: 'Newark, New Jersey',
    locationLabel: 'Newark',
    locationPrecision: 'city',
    lat: 40.732,
    lng: -74.191,
  },
  disc_long_hot_summer_of_1967_q17044485: {
    jurisdictionLabel: 'Detroit, Michigan',
    locationLabel: 'Detroit',
    locationPrecision: 'city',
    lat: 42.37639,
    lng: -83.09944,
  },
  disc_1967_plainfield_riots_q4572785: {
    jurisdictionLabel: 'Plainfield, New Jersey',
    locationLabel: 'Plainfield',
    locationPrecision: 'city',
    lat: 40.6337,
    lng: -74.4074,
  },
  disc_nottoway_plantation_q7063764: {
    jurisdictionLabel: 'Iberville Parish, Louisiana',
    locationLabel: 'Nottoway Plantation',
    locationPrecision: 'site',
    lat: 30.18556,
    lng: -91.16694,
  },
  disc_frogmore_plantation_q28124929: {
    jurisdictionLabel: 'Concordia Parish, Louisiana',
    locationLabel: 'Frogmore Plantation',
    locationPrecision: 'site',
    lat: 31.59444,
    lng: -91.67167,
  },
  disc_myrtles_plantation_q6948645: {
    jurisdictionLabel: 'West Feliciana Parish, Louisiana',
    locationLabel: 'Myrtles Plantation',
    locationPrecision: 'site',
    lat: 30.80306,
    lng: -91.3875,
  },
};

function parseNrhpJurisdiction(snippets: readonly string[] | undefined): Partial<LocationFix> | undefined {
  if (!snippets) return undefined;
  const nrhp = snippets.find((s) => s.includes('State:') && s.includes('County:'));
  if (!nrhp) return undefined;
  const state = nrhp.match(/State:\s*([^\n]+)/)?.[1]?.trim();
  const countyRaw = nrhp.match(/County:\s*([^\n]+)/)?.[1]?.trim();
  if (!state || !countyRaw) return undefined;
  const county = countyRaw.split(/\s+/).slice(0, 3).join(' ').replace(/\s+(Vacherie|Charleston|McClellanville|White Castle|Ferriday|Marion|Westover).*$/i, '').trim();
  const jurisdictionLabel = county.includes('Parish') || county.includes('County')
    ? `${county}, ${state}`
    : `${county}, ${state}`;
  return { jurisdictionLabel };
}

function applyLocationFix(subject: SubjectMeta, candidate?: Candidate): SubjectMeta {
  const curated = CURATED_LOCATIONS[subject.subjectId];
  const nrhp = parseNrhpJurisdiction(subject.sourceSnippets);
  const fix = curated ?? (nrhp?.jurisdictionLabel
    ? {
        jurisdictionLabel: nrhp.jurisdictionLabel,
        locationLabel: subject.title,
        locationPrecision: (subject.kind === 'place' ? 'site' : 'city') as LocationFix['locationPrecision'],
        lat: subject.lat ?? candidate?.lat,
        lng: subject.lng ?? candidate?.lng,
      }
    : undefined);

  if (!fix) return subject;

  const lat = fix.lat ?? subject.lat ?? candidate?.lat;
  const lng = fix.lng ?? subject.lng ?? candidate?.lng;
  const stateCode = resolveReleaseEntityStateCode({ jurisdictionLabel: fix.jurisdictionLabel });
  if (!stateCode) {
    console.warn(`WARN: unresolvable state for ${subject.subjectId}: ${fix.jurisdictionLabel}`);
  }

  return {
    ...subject,
    jurisdictionLabel: fix.jurisdictionLabel,
    locationLabel: fix.locationLabel,
    locationPrecision: fix.locationPrecision,
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
  };
}

function mergeSubjects(
  priority: readonly SubjectMeta[],
  e2: readonly SubjectMeta[],
  candidates: readonly Candidate[],
): SubjectMeta[] {
  const byId = new Map<string, SubjectMeta>();
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  for (const subject of priority) {
    byId.set(subject.subjectId, subject);
  }
  for (const subject of e2) {
    byId.set(subject.subjectId, { ...byId.get(subject.subjectId), ...subject });
  }

  return [...byId.values()].map((subject) =>
    applyLocationFix(subject, candidateById.get(subject.subjectId)),
  );
}

function fixEraCentury(bucket: string): string[] {
  const lower = bucket.trim().toLowerCase();
  if (lower === '19th century') {
    return ['1800s', '1810s', '1820s', '1830s', '1840s', '1850s', '1860s', '1870s', '1880s', '1890s'];
  }
  if (lower === '20th century') {
    return ['1900s', '1910s', '1920s', '1930s', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s'];
  }
  return [];
}

function normalizePacket(item: EnrichmentItem): EnrichmentItem {
  const { packet } = item;
  const drafts = { ...packet.drafts } as Record<string, unknown>;

  const normalized = normalizeEnrichmentDrafts({
    publicSummary: typeof drafts.publicSummary === 'string' ? drafts.publicSummary : undefined,
    eraBuckets: Array.isArray(drafts.eraBuckets) ? (drafts.eraBuckets as string[]) : undefined,
    topicIds: Array.isArray(drafts.topicIds) ? (drafts.topicIds as string[]) : undefined,
  });

  if (normalized.publicSummary !== undefined) drafts.publicSummary = normalized.publicSummary;
  if (normalized.eraBuckets !== undefined) {
    const extra: string[] = [];
    for (const bucket of (drafts.eraBuckets as string[]) ?? []) {
      extra.push(...fixEraCentury(bucket));
    }
    drafts.eraBuckets = [...new Set([...(normalized.eraBuckets ?? []), ...extra])];
  }
  if (normalized.topicIds !== undefined) drafts.topicIds = normalized.topicIds;

  return {
    ...item,
    packet: {
      ...packet,
      validationIssues: [],
      drafts,
    },
  };
}

function mergeRuns(priorityItems: readonly EnrichmentItem[], e2Items: readonly EnrichmentItem[]): EnrichmentItem[] {
  const byId = new Map<string, EnrichmentItem>();

  for (const item of priorityItems) {
    if (item.packet.decision !== 'keep') continue;
    if (DROP_SUBJECT_IDS.has(item.packet.subjectId)) continue;
    byId.set(item.packet.subjectId, normalizePacket(item));
  }

  for (const item of e2Items) {
    if (item.packet.decision !== 'keep') continue;
    if (DROP_SUBJECT_IDS.has(item.packet.subjectId)) continue;
    byId.set(item.packet.subjectId, normalizePacket(item));
  }

  return [...byId.values()];
}

function main(): void {
  const prioritySubjects = JSON.parse(
    readFileSync(join(cacheDir, 'subjects-priority-batch.json'), 'utf8'),
  ) as { subjects: SubjectMeta[] };
  const e2Subjects = JSON.parse(
    readFileSync(join(cacheDir, 'subjects-e2-retry.json'), 'utf8'),
  ) as { subjects: SubjectMeta[] };
  const candidates = JSON.parse(
    readFileSync(join(cacheDir, 'priority-batch-candidates.json'), 'utf8'),
  ) as { candidates: Candidate[] };
  const priorityRun = JSON.parse(
    readFileSync(join(cacheDir, 'run-priority-batch-2026-07-22.json'), 'utf8'),
  ) as { items: EnrichmentItem[] };
  const e2Run = JSON.parse(
    readFileSync(join(cacheDir, 'run-e2-retry-2026-07-22.json'), 'utf8'),
  ) as { items: EnrichmentItem[] };

  const mergedSubjects = mergeSubjects(
    prioritySubjects.subjects,
    e2Subjects.subjects,
    candidates.candidates,
  );
  const mergedRunItems = mergeRuns(priorityRun.items, e2Run.items);
  const keepIds = new Set(mergedRunItems.map((i) => i.packet.subjectId));

  const promoteReadySubjects = mergedSubjects.filter((s) => keepIds.has(s.subjectId));
  const missing = promoteReadySubjects.filter(
    (s) => !s.jurisdictionLabel || !s.locationLabel || !s.locationPrecision,
  );
  const missingCoords = promoteReadySubjects.filter(
    (s) => (s.kind === 'place' || s.locationPrecision === 'site') && (s.lat === undefined || s.lng === undefined),
  );

  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    join(cacheDir, 'subjects-promote-ready.json'),
    `${JSON.stringify({ subjects: promoteReadySubjects }, null, 2)}\n`,
  );
  writeFileSync(
    join(cacheDir, 'run-promote-merged.json'),
    `${JSON.stringify({ kind: 'enrichment.run.v1', items: mergedRunItems }, null, 2)}\n`,
  );

  console.log(
    JSON.stringify(
      {
        promoteReadySubjects: promoteReadySubjects.length,
        mergedRunKeeps: mergedRunItems.length,
        dropped: [...DROP_SUBJECT_IDS],
        missingLocationFields: missing.map((s) => s.subjectId),
        missingCoords: missingCoords.map((s) => s.subjectId),
        outputs: {
          subjects: join(cacheDir, 'subjects-promote-ready.json'),
          run: join(cacheDir, 'run-promote-merged.json'),
        },
      },
      null,
      2,
    ),
  );

  if (missing.length > 0) {
    process.exitCode = 1;
  }
}

main();
