/**
 * Decade world packets for Lives Across the Decades: authored beats that open the archive on
 * housing, school, policy, justice, testimony, culture, and war beside the published figures.
 * Gap cards are first-class when a domain has no sourced payload. Method:
 * docs/methodology/lives-across-decades.md. Scholarship labels:
 * docs/methodology/scholarship-principles.md.
 */
import { LIVES_AREAS, LIVES_NATIONAL } from './lives-regions.js';
import { LIVES_DECADES, isLivesDecade, type LivesDecade } from './lives-regimes.js';
import { isLivesLens, type LivesLens } from './race-ethnicity-slices.js';
import { LIVES_UNITS, isLivesUnit, type LivesUnit } from './lives-units.js';
import type { LivesSourceRef } from './lives-timeline.js';

export const LIVES_WORLD_DOMAINS = [
  'housing',
  'affordance',
  'income',
  'schooling',
  'work',
  'health',
  'family',
  'world',
  'culture',
  'count',
  'political',
  'justice',
  'policy',
  'impact',
  'testimony',
] as const;

export type LivesWorldDomain = (typeof LIVES_WORLD_DOMAINS)[number];

export const LIVES_WORLD_DOMAIN_LABELS: Readonly<Record<LivesWorldDomain, string>> = {
  housing: 'Housing',
  affordance: 'What income could cover',
  income: 'Real income',
  schooling: 'School',
  work: 'Work',
  health: 'Health',
  family: 'Family',
  world: 'War and migration',
  culture: 'Media and music',
  count: 'What the count could see',
  political: 'Politics and pressure',
  justice: 'Justice',
  policy: 'Policy',
  impact: 'Impact',
  testimony: 'Testimony',
};

export const LIVES_WORLD_CLAIM_TYPES = ['factual', 'interpretive', 'testimony', 'modeled'] as const;

export type LivesWorldClaimType = (typeof LIVES_WORLD_CLAIM_TYPES)[number];

export const LIVES_WORLD_GAP_STATES = ['insufficient_evidence', 'modeled'] as const;

export type LivesWorldGapState = (typeof LIVES_WORLD_GAP_STATES)[number];

/**
 * How a speaker's words reached the page. A memoir, an edited as-told-to transcription, a
 * journalist's report and a recorded interview are different kinds of evidence, and only the first
 * is a person speaking for themselves. Every speaker carries one, shown beside the name, so a
 * mediated account never stands in unlabeled for a group's own voice.
 */
export const LIVES_WORLD_MEDIATIONS = [
  'self-authored',
  'as-told-to',
  'reported-by-third-party',
  'recorded-interview',
] as const;
export type LivesWorldMediation = (typeof LIVES_WORLD_MEDIATIONS)[number];

export const LIVES_WORLD_MEDIATION_LABELS: Readonly<Record<LivesWorldMediation, string>> = {
  'self-authored': 'In their own writing',
  'as-told-to': 'As told to',
  'reported-by-third-party': 'Reported by an observer',
  'recorded-interview': 'Recorded interview with',
};

/** Mediations that name a second person: the writer who took the account down, or the interviewer. */
const MEDIATIONS_NAMING_A_SECOND_PERSON: readonly LivesWorldMediation[] = [
  'as-told-to',
  'recorded-interview',
];

export type LivesWorldSpeaker = {
  readonly name: string;
  readonly place: string;
  readonly year: string;
  readonly classNote?: string;
  readonly mediation: LivesWorldMediation;
  /** Required for as-told-to and recorded-interview: who took the account down or asked the questions. */
  readonly mediatedBy?: string;
};

/**
 * A recording the public can hear, held by an archive. Lives points at it and never stores it: the
 * oral-history adapter's rule (pointers and short quotes only, never audio or full transcripts)
 * holds here too. Verified sources and the rights reading are in
 * docs/research/lives-audio-sources.md.
 */
export type LivesWorldRecording = {
  /** Direct https URL of the archive's own media file. */
  readonly mediaUrl: string;
  /** The archive's item page, the fallback when the stream does not play. */
  readonly itemUrl: string;
  readonly transcriptUrl?: string;
  readonly holdingInstitution: string;
  /** The archive's credit line for the source collection, as the archive asks for it. */
  readonly creditLine: string;
  /** The archive's own rights statement, quoted. */
  readonly rightsNote: string;
  /** When and where the recording was made, e.g. "June 11, 1949, Baltimore, Maryland". */
  readonly recordedOn: string;
  /** Shown before play when the recording carries period language or describes violence. */
  readonly contentNote?: string;
};

/** A verbatim quotation may run to 40 words: docs/methodology/chapter-fact-validation.md. */
export const LIVES_WORLD_QUOTE_MAX_WORDS = 40;

/** "As told to Theodore Rosengarten", "In their own writing": the line shown beside a speaker. */
export function livesWorldMediationLine(speaker: LivesWorldSpeaker): string {
  const label = LIVES_WORLD_MEDIATION_LABELS[speaker.mediation];
  return speaker.mediatedBy && MEDIATIONS_NAMING_A_SECOND_PERSON.includes(speaker.mediation)
    ? `${label} ${speaker.mediatedBy}`
    : label;
}

/** Authored beat before entity hrefs are resolved at snapshot build. */
export type LivesWorldBeatInput = {
  readonly id: string;
  readonly decade: LivesDecade;
  /** Empty means every area. */
  readonly areaIds: readonly string[];
  readonly lenses: readonly (LivesLens | 'all')[];
  readonly unit: LivesUnit | 'all';
  readonly domain: LivesWorldDomain;
  readonly claimType: LivesWorldClaimType;
  readonly uncertaintyLabel?: string;
  readonly gapState?: LivesWorldGapState;
  readonly heading: string;
  readonly body: string;
  readonly citations: readonly LivesSourceRef[];
  readonly entityIds: readonly string[];
  readonly speaker?: LivesWorldSpeaker;
  /** The speaker's own words, verbatim from the cited source. Requires a speaker. */
  readonly quote?: string;
  /** Requires a speaker whose mediation is `recorded-interview`. */
  readonly recording?: LivesWorldRecording;
};

export type LivesWorldBeat = {
  readonly id: string;
  readonly domain: LivesWorldDomain;
  readonly claimType: LivesWorldClaimType;
  readonly uncertaintyLabel?: string;
  readonly gapState?: LivesWorldGapState;
  readonly heading: string;
  readonly body: string;
  readonly citations: readonly LivesSourceRef[];
  readonly appliesTo: readonly (LivesLens | 'all')[];
  readonly unit: LivesUnit | 'all';
  readonly entities: readonly {
    readonly id: string;
    readonly href: string | null;
    readonly label: string;
  }[];
  readonly speaker?: LivesWorldSpeaker;
  /** True when the speaker's place is outside the selected area's story geography. */
  readonly speakerPlaceMismatch?: boolean;
  readonly quote?: string;
  readonly recording?: LivesWorldRecording;
};

export type LivesWorldGapCard = {
  readonly domain: LivesWorldDomain;
  readonly heading: string;
  readonly body: string;
};

const MAX_HEADING = 120;
const MAX_BODY = 900;

const AREA_IDS = new Set([LIVES_NATIONAL.id, ...LIVES_AREAS.map((area) => area.id)]);

export function isLivesWorldDomain(value: string): value is LivesWorldDomain {
  return (LIVES_WORLD_DOMAINS as readonly string[]).includes(value);
}

export function isLivesWorldClaimType(value: string): value is LivesWorldClaimType {
  return (LIVES_WORLD_CLAIM_TYPES as readonly string[]).includes(value);
}

/**
 * Validates authored world beats the same way count notes are validated: citations required,
 * no research markers, no spaced em dashes, claim type required.
 */
export function validateLivesWorldBeats(input: unknown): {
  readonly records: LivesWorldBeatInput[];
  readonly errors: string[];
} {
  const errors: string[] = [];
  if (!Array.isArray(input))
    return { records: [], errors: ['world beats file must be a JSON array'] };
  const seen = new Set<string>();
  const records: LivesWorldBeatInput[] = [];

  input.forEach((raw, index) => {
    const where = `beat ${index}`;
    if (!raw || typeof raw !== 'object') {
      errors.push(`${where}: not an object`);
      return;
    }
    const beat = raw as Record<string, unknown>;
    const id = typeof beat.id === 'string' ? beat.id : '';
    const label = id ? `${where} (${id})` : where;
    const problems: string[] = [];
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) problems.push('id must be kebab-case');
    if (seen.has(id)) problems.push('duplicate id');
    seen.add(id);

    const decade = beat.decade;
    if (typeof decade !== 'number' || !isLivesDecade(decade)) {
      problems.push('decade must be a timeline decade');
    }

    const lenses = Array.isArray(beat.lenses) ? beat.lenses : [];
    if (
      lenses.length === 0 ||
      !lenses.every((value) => value === 'all' || (typeof value === 'string' && isLivesLens(value)))
    ) {
      problems.push('lenses must list black, white, hispanic or all');
    }

    const areas = Array.isArray(beat.areaIds) ? beat.areaIds : [];
    if (!areas.every((value) => typeof value === 'string' && AREA_IDS.has(value))) {
      problems.push('areaIds must be Lives area ids');
    }

    const unit = beat.unit;
    if (unit !== 'all' && (typeof unit !== 'string' || !isLivesUnit(unit))) {
      problems.push('unit must be household, child, woman or all');
    }

    const domain = beat.domain;
    if (typeof domain !== 'string' || !isLivesWorldDomain(domain)) {
      problems.push('domain must be a known world domain');
    }

    const claimType = beat.claimType;
    if (typeof claimType !== 'string' || !isLivesWorldClaimType(claimType)) {
      problems.push('claimType must be factual, interpretive, testimony or modeled');
    }

    for (const field of ['heading', 'body'] as const) {
      const text = beat[field];
      const max = field === 'heading' ? MAX_HEADING : MAX_BODY;
      if (typeof text !== 'string' || text.trim().length === 0) {
        problems.push(`${field} is required`);
      } else {
        if (text.length > max) problems.push(`${field} is longer than ${max} characters`);
        if (/\s—\s/.test(text)) problems.push(`${field} has a spaced em dash`);
        if (/UNVERIFIED|TODO/i.test(text)) problems.push(`${field} carries a research marker`);
      }
    }

    if (claimType === 'testimony') {
      const speaker = beat.speaker;
      if (!speaker || typeof speaker !== 'object') {
        problems.push('testimony requires a speaker');
      } else {
        const s = speaker as Record<string, unknown>;
        for (const field of ['name', 'place', 'year'] as const) {
          if (typeof s[field] !== 'string' || !(s[field] as string).trim()) {
            problems.push(`speaker.${field} is required`);
          }
        }
      }
    }

    // Any beat that names a speaker says how the words reached the page, whatever its claim type.
    if (beat.speaker && typeof beat.speaker === 'object') {
      const s = beat.speaker as Record<string, unknown>;
      const mediation = s.mediation;
      if (
        typeof mediation !== 'string' ||
        !(LIVES_WORLD_MEDIATIONS as readonly string[]).includes(mediation)
      ) {
        problems.push(
          'speaker.mediation must be self-authored, as-told-to, reported-by-third-party or recorded-interview',
        );
      } else if (
        MEDIATIONS_NAMING_A_SECOND_PERSON.includes(mediation as LivesWorldMediation) &&
        (typeof s.mediatedBy !== 'string' || !s.mediatedBy.trim())
      ) {
        problems.push(`speaker.mediatedBy is required when mediation is ${mediation}`);
      }
    }

    let quote: string | undefined;
    if (beat.quote !== undefined) {
      if (typeof beat.quote !== 'string' || beat.quote.trim().length === 0) {
        problems.push('quote must be a non-empty string');
      } else if (!beat.speaker || typeof beat.speaker !== 'object') {
        problems.push('a quote requires a speaker');
      } else if (beat.quote.trim().split(/\s+/).length > LIVES_WORLD_QUOTE_MAX_WORDS) {
        problems.push(`quote is longer than ${LIVES_WORLD_QUOTE_MAX_WORDS} words`);
      } else {
        quote = beat.quote.trim();
      }
    }

    let recording: LivesWorldRecording | undefined;
    if (beat.recording !== undefined) {
      const r = beat.recording as Record<string, unknown> | null;
      if (!r || typeof r !== 'object') {
        problems.push('recording must be an object');
      } else {
        const text = (key: string): string =>
          typeof r[key] === 'string' ? (r[key] as string).trim() : '';
        for (const key of ['mediaUrl', 'itemUrl'] as const) {
          if (!/^https:\/\//.test(text(key)))
            problems.push(`recording.${key} must be an https URL`);
        }
        if (r.transcriptUrl !== undefined && !/^https:\/\//.test(text('transcriptUrl'))) {
          problems.push('recording.transcriptUrl must be an https URL');
        }
        for (const key of [
          'holdingInstitution',
          'creditLine',
          'rightsNote',
          'recordedOn',
        ] as const) {
          if (!text(key)) problems.push(`recording.${key} is required`);
        }
        const speaker = beat.speaker as Record<string, unknown> | undefined;
        if (!speaker || speaker.mediation !== 'recorded-interview') {
          problems.push('a recording requires a speaker whose mediation is recorded-interview');
        }
        // Any problem above aborts the record before this value is read.
        recording = {
          mediaUrl: text('mediaUrl'),
          itemUrl: text('itemUrl'),
          ...(text('transcriptUrl') ? { transcriptUrl: text('transcriptUrl') } : {}),
          holdingInstitution: text('holdingInstitution'),
          creditLine: text('creditLine'),
          rightsNote: text('rightsNote'),
          recordedOn: text('recordedOn'),
          ...(text('contentNote') ? { contentNote: text('contentNote') } : {}),
        };
      }
    }

    const citations = Array.isArray(beat.citations) ? beat.citations : [];
    const validCitations = citations.filter(
      (citation): citation is LivesSourceRef =>
        !!citation &&
        typeof citation === 'object' &&
        typeof (citation as LivesSourceRef).label === 'string' &&
        typeof (citation as LivesSourceRef).url === 'string' &&
        /^https:\/\//.test((citation as LivesSourceRef).url),
    );
    if (validCitations.length === 0) {
      problems.push('at least one https citation is required');
    }

    const entityIds = Array.isArray(beat.entityIds)
      ? beat.entityIds.filter((value): value is string => typeof value === 'string')
      : [];

    let gapState: LivesWorldGapState | undefined;
    if (beat.gapState !== undefined) {
      if (
        typeof beat.gapState !== 'string' ||
        !(LIVES_WORLD_GAP_STATES as readonly string[]).includes(beat.gapState)
      ) {
        problems.push('gapState must be insufficient_evidence or modeled');
      } else {
        gapState = beat.gapState as LivesWorldGapState;
      }
    }

    if (problems.length > 0) {
      for (const problem of problems) errors.push(`${label}: ${problem}`);
      return;
    }

    const record: LivesWorldBeatInput = {
      id,
      decade: decade as LivesDecade,
      areaIds: areas as string[],
      lenses: lenses as (LivesLens | 'all')[],
      unit: unit as LivesUnit | 'all',
      domain: domain as LivesWorldDomain,
      claimType: claimType as LivesWorldClaimType,
      heading: (beat.heading as string).trim(),
      body: (beat.body as string).trim(),
      citations: validCitations,
      entityIds,
      ...(typeof beat.uncertaintyLabel === 'string' && beat.uncertaintyLabel.trim()
        ? { uncertaintyLabel: beat.uncertaintyLabel.trim() }
        : {}),
      ...(gapState ? { gapState } : {}),
      ...(beat.speaker && typeof beat.speaker === 'object'
        ? {
            speaker: {
              name: String((beat.speaker as LivesWorldSpeaker).name).trim(),
              place: String((beat.speaker as LivesWorldSpeaker).place).trim(),
              year: String((beat.speaker as LivesWorldSpeaker).year).trim(),
              mediation: (beat.speaker as LivesWorldSpeaker).mediation,
              ...((beat.speaker as LivesWorldSpeaker).mediatedBy
                ? { mediatedBy: String((beat.speaker as LivesWorldSpeaker).mediatedBy).trim() }
                : {}),
              ...((beat.speaker as LivesWorldSpeaker).classNote
                ? { classNote: String((beat.speaker as LivesWorldSpeaker).classNote).trim() }
                : {}),
            },
          }
        : {}),
      ...(quote ? { quote } : {}),
      ...(recording ? { recording } : {}),
    };
    records.push(record);
  });

  return { records, errors };
}

/** Default gap copy when a domain has no beat for a decade. */
export function livesWorldGapCard(
  domain: LivesWorldDomain,
  decade: LivesDecade,
): LivesWorldGapCard {
  const label = LIVES_WORLD_DOMAIN_LABELS[domain];
  switch (domain) {
    case 'health':
      return {
        domain,
        heading: `${label} in the ${decade}s`,
        body: 'No race-crossed region health rate is published for this decade on the Lives timeline. National life-expectancy series live on Data.',
      };
    case 'justice':
      return {
        domain,
        heading: `${label} in the ${decade}s`,
        body: 'No race-crossed crime or police-stop count is shown as a Lives cell. Imprisonment series and cases open as off-ramps when published.',
      };
    case 'affordance':
      return {
        domain,
        heading: `${label} in the ${decade}s`,
        body: 'A same-year rent or home-value model has not been built for this decade yet. Income bands alone are not a price.',
      };
    case 'testimony':
      return {
        domain,
        heading: `${label} in the ${decade}s`,
        body: 'No sourced memoir or oral history is linked for this area and decade yet.',
      };
    default:
      return {
        domain,
        heading: `${label} in the ${decade}s`,
        body: `No sourced ${label.toLowerCase()} beat is recorded for this area and decade yet.`,
      };
  }
}

/**
 * Filters authored beats for one area × decade × unit × lens emphasis, and fills gap cards for
 * domains that still have nothing to show.
 */
export function selectLivesWorldBeats(input: {
  readonly beats: readonly LivesWorldBeat[];
  readonly decade: LivesDecade;
  readonly unit: LivesUnit | 'all';
  readonly emphasis: LivesLens;
  readonly domains?: readonly LivesWorldDomain[];
}): {
  readonly beats: readonly LivesWorldBeat[];
  readonly gaps: readonly LivesWorldGapCard[];
} {
  const domains = input.domains ?? LIVES_WORLD_DOMAINS;
  const matched = input.beats.filter((beat) => {
    if (input.unit !== 'all' && beat.unit !== 'all' && beat.unit !== input.unit) return false;
    if (!beat.appliesTo.includes('all') && !beat.appliesTo.includes(input.emphasis)) {
      return false;
    }
    return domains.includes(beat.domain);
  });
  const present = new Set(matched.map((beat) => beat.domain));
  const gaps = domains
    .filter((domain) => !present.has(domain))
    .map((domain) => livesWorldGapCard(domain, input.decade));
  return { beats: matched, gaps };
}

/** Domains every decade should surface even when empty (gap cards). */
export const LIVES_WORLD_CORE_DOMAINS: readonly LivesWorldDomain[] = [
  'count',
  'housing',
  'affordance',
  'income',
  'schooling',
  'work',
  'health',
  'policy',
  'political',
  'justice',
  'world',
  'testimony',
];

void LIVES_DECADES;
void LIVES_UNITS;
