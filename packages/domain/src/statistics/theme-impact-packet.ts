/**
 * Theme-impact packet contract: the public answer unit for a canonical
 * theme-impact question (Q1–Q9). Composes observation/derived/artifact refs with
 * provenance, method stance, and gap labels. Juxtaposition is the default;
 * gated causal language requires claim ids. Does not ingest or publish data.
 */
import type { ThemeImpactThemeId } from './theme-impact-questions.js';
import type { StatisticalGeographyType } from './types.js';

export const THEME_IMPACT_PACKET_KIND = 'theme.impact.packet.v1' as const;

export const THEME_IMPACT_METHOD_STANCES = ['juxtaposition', 'gated_causal_claim'] as const;
export type ThemeImpactMethodStance = (typeof THEME_IMPACT_METHOD_STANCES)[number];

export const THEME_IMPACT_PACKET_STATUSES = ['draft', 'review', 'published'] as const;
export type ThemeImpactPacketStatus = (typeof THEME_IMPACT_PACKET_STATUSES)[number];

export const THEME_IMPACT_GAP_STATES = ['insufficient_evidence', 'modeled'] as const;
export type ThemeImpactGapState = (typeof THEME_IMPACT_GAP_STATES)[number];

export const THEME_IMPACT_BINDING_PURPOSES = ['map_panel', 'story', 'research'] as const;
export type ThemeImpactBindingPurpose = (typeof THEME_IMPACT_BINDING_PURPOSES)[number];

/** Provenance quartet + human-readable citation required on public numbers. */
export type ThemeImpactProvenanceQuartet = {
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly humanCitation: string;
};

export type ThemeImpactPacketGeography = {
  readonly geographyType: StatisticalGeographyType | 'custom_polygon' | 'holc_poly';
  readonly boundaryVersion: string;
  readonly jurisdictionId?: string;
  readonly label?: string;
};

export type ThemeImpactPacketObservation = {
  readonly observationId: string;
  readonly metricId: string;
  readonly estimate: number;
  readonly unit: string;
  readonly referencePeriod: string;
  readonly provenance: ThemeImpactProvenanceQuartet;
  readonly label?: string;
};

export type ThemeImpactPacketDerived = {
  readonly derivedId: string;
  readonly methodId: string;
  readonly value: number;
  readonly unit: string;
  readonly status: 'derived' | 'modeled';
  readonly formula: string;
  readonly inputObservationIds: readonly string[];
  readonly provenance: ThemeImpactProvenanceQuartet;
  readonly label?: string;
};

export type ThemeImpactPacketArtifact = {
  readonly artifactId: string;
  readonly artifactClass: string;
  readonly title: string;
  readonly citation: string;
  readonly dated?: string;
  readonly summary?: string;
  readonly uncertaintyLabel?: string;
  readonly claimId?: string;
  readonly captureId?: string;
  readonly sourceUrl?: string;
};

export type ThemeImpactEntityBinding = {
  readonly entityId: string;
  readonly purpose: ThemeImpactBindingPurpose;
};

export type ThemeImpactPacket = {
  readonly kind: typeof THEME_IMPACT_PACKET_KIND;
  readonly id: string;
  readonly questionId: string;
  readonly themeId: ThemeImpactThemeId;
  readonly title: string;
  readonly summary: string;
  readonly policyEras: readonly string[];
  readonly geography: ThemeImpactPacketGeography;
  readonly methodStance: ThemeImpactMethodStance;
  readonly methodNote: string;
  readonly observations: readonly ThemeImpactPacketObservation[];
  readonly derived: readonly ThemeImpactPacketDerived[];
  readonly artifacts: readonly ThemeImpactPacketArtifact[];
  readonly gapStates: readonly ThemeImpactGapState[];
  readonly entityBinding?: ThemeImpactEntityBinding;
  readonly causalClaimIds?: readonly string[];
  readonly status: ThemeImpactPacketStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type BuildThemeImpactPacketInput = {
  readonly id: string;
  readonly questionId: string;
  readonly themeId: ThemeImpactThemeId;
  readonly title: string;
  readonly summary?: string;
  readonly policyEras?: readonly string[];
  readonly geography: ThemeImpactPacketGeography;
  readonly methodStance?: ThemeImpactMethodStance;
  readonly methodNote: string;
  readonly observations?: readonly ThemeImpactPacketObservation[];
  readonly derived?: readonly ThemeImpactPacketDerived[];
  readonly artifacts?: readonly ThemeImpactPacketArtifact[];
  readonly gapStates?: readonly ThemeImpactGapState[];
  readonly entityBinding?: ThemeImpactEntityBinding;
  readonly causalClaimIds?: readonly string[];
  readonly status?: ThemeImpactPacketStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function freezeProvenance(p: ThemeImpactProvenanceQuartet): ThemeImpactProvenanceQuartet {
  return Object.freeze({ ...p });
}

function freezeGeography(g: ThemeImpactPacketGeography): ThemeImpactPacketGeography {
  return Object.freeze({
    geographyType: g.geographyType,
    boundaryVersion: g.boundaryVersion,
    ...(g.jurisdictionId !== undefined ? { jurisdictionId: g.jurisdictionId } : {}),
    ...(g.label !== undefined ? { label: g.label } : {}),
  });
}

function freezeObservation(row: ThemeImpactPacketObservation): ThemeImpactPacketObservation {
  return Object.freeze({
    observationId: row.observationId,
    metricId: row.metricId,
    estimate: row.estimate,
    unit: row.unit,
    referencePeriod: row.referencePeriod,
    provenance: freezeProvenance(row.provenance),
    ...(row.label !== undefined ? { label: row.label } : {}),
  });
}

function freezeDerived(row: ThemeImpactPacketDerived): ThemeImpactPacketDerived {
  return Object.freeze({
    derivedId: row.derivedId,
    methodId: row.methodId,
    value: row.value,
    unit: row.unit,
    status: row.status,
    formula: row.formula,
    inputObservationIds: Object.freeze([...row.inputObservationIds]),
    provenance: freezeProvenance(row.provenance),
    ...(row.label !== undefined ? { label: row.label } : {}),
  });
}

function freezeArtifact(row: ThemeImpactPacketArtifact): ThemeImpactPacketArtifact {
  return Object.freeze({
    artifactId: row.artifactId,
    artifactClass: row.artifactClass,
    title: row.title,
    citation: row.citation,
    ...(row.dated !== undefined ? { dated: row.dated } : {}),
    ...(row.summary !== undefined ? { summary: row.summary } : {}),
    ...(row.uncertaintyLabel !== undefined ? { uncertaintyLabel: row.uncertaintyLabel } : {}),
    ...(row.claimId !== undefined ? { claimId: row.claimId } : {}),
    ...(row.captureId !== undefined ? { captureId: row.captureId } : {}),
    ...(row.sourceUrl !== undefined ? { sourceUrl: row.sourceUrl } : {}),
  });
}

function requireNonEmpty(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`${label} must be non-empty`);
  }
}

function provenanceComplete(p: ThemeImpactProvenanceQuartet, path: string): void {
  requireNonEmpty(p.source, `${path}.source`);
  requireNonEmpty(p.sourceUrl, `${path}.sourceUrl`);
  requireNonEmpty(p.retrievedAt, `${path}.retrievedAt`);
  requireNonEmpty(p.contentHash, `${path}.contentHash`);
  requireNonEmpty(p.humanCitation, `${path}.humanCitation`);
}

/** Pure builder for a theme-impact answer packet. */
export function buildThemeImpactPacket(input: BuildThemeImpactPacketInput): ThemeImpactPacket {
  requireNonEmpty(input.id, 'id');
  requireNonEmpty(input.questionId, 'questionId');
  requireNonEmpty(input.title, 'title');
  requireNonEmpty(input.methodNote, 'methodNote');
  requireNonEmpty(input.geography.boundaryVersion, 'geography.boundaryVersion');
  requireNonEmpty(input.createdAt, 'createdAt');
  requireNonEmpty(input.updatedAt, 'updatedAt');

  return Object.freeze({
    kind: THEME_IMPACT_PACKET_KIND,
    id: input.id,
    questionId: input.questionId,
    themeId: input.themeId,
    title: input.title,
    summary: input.summary ?? '',
    policyEras: Object.freeze([...(input.policyEras ?? [])]),
    geography: freezeGeography(input.geography),
    methodStance: input.methodStance ?? 'juxtaposition',
    methodNote: input.methodNote,
    observations: Object.freeze((input.observations ?? []).map(freezeObservation)),
    derived: Object.freeze((input.derived ?? []).map(freezeDerived)),
    artifacts: Object.freeze((input.artifacts ?? []).map(freezeArtifact)),
    gapStates: Object.freeze([...(input.gapStates ?? [])]),
    ...(input.entityBinding !== undefined
      ? { entityBinding: Object.freeze({ ...input.entityBinding }) }
      : {}),
    ...(input.causalClaimIds !== undefined
      ? { causalClaimIds: Object.freeze([...input.causalClaimIds]) }
      : {}),
    status: input.status ?? 'draft',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

/**
 * Fail-closed publish gate. Published packets must carry full provenance on every
 * observation and derived row. `gated_causal_claim` requires at least one claim id
 * (artifact.claimId or causalClaimIds). Q10-style methodology packets may publish
 * with empty metrics when methodNote is present and questionId is Q10.
 */
export function assertThemeImpactPacketPublishable(packet: ThemeImpactPacket): void {
  if (packet.status !== 'published') {
    throw new Error('assertThemeImpactPacketPublishable requires status published');
  }
  requireNonEmpty(packet.methodNote, 'methodNote');

  const isMethodologyGate = packet.questionId === 'Q10';
  if (
    !isMethodologyGate &&
    packet.observations.length === 0 &&
    packet.derived.length === 0 &&
    packet.artifacts.length === 0
  ) {
    throw new Error(
      'published theme-impact packet requires observations, derived measurements, or artifacts',
    );
  }

  packet.observations.forEach((row, index) => {
    provenanceComplete(row.provenance, `observations[${index}].provenance`);
  });
  packet.derived.forEach((row, index) => {
    provenanceComplete(row.provenance, `derived[${index}].provenance`);
    if (row.inputObservationIds.length < 1) {
      throw new Error(`derived[${index}] requires inputObservationIds`);
    }
  });

  if (packet.methodStance === 'gated_causal_claim') {
    const fromArtifacts = packet.artifacts.some((a) => Boolean(a.claimId?.trim()));
    const fromExplicit = (packet.causalClaimIds ?? []).some((id) => Boolean(id.trim()));
    if (!fromArtifacts && !fromExplicit) {
      throw new Error(
        'gated_causal_claim requires claimId on an artifact or causalClaimIds on the packet',
      );
    }
  }
}

/** Sample redlining Q3 packet for tests and UI fixtures. */
export function createRedliningQ3FixturePacket(
  overrides?: Partial<BuildThemeImpactPacketInput>,
): ThemeImpactPacket {
  const provenance: ThemeImpactProvenanceQuartet = {
    source: 'ACS 5-Year Detailed Tables',
    sourceUrl: 'https://api.census.gov/data/2022/acs/acs5',
    retrievedAt: '2026-07-22T12:00:00.000Z',
    contentHash: 'sha256:fixture-acs-homeownership-black-county',
    humanCitation: 'U.S. Census Bureau, ACS 2018–2022 5-Year, table B25003B (fixture).',
  };

  return buildThemeImpactPacket({
    id: 'tip_fixture_redlining_q3_baltimore',
    questionId: 'Q3',
    themeId: 'redlining',
    title: 'Black homeownership across housing-credit eras (Baltimore metro fixture)',
    summary:
      'County indicators shown beside HOLC-era context for juxtaposition — not proof of a single cause.',
    policyEras: ['holc_fha', 'fair_housing', 'cra_contemporary'],
    geography: {
      geographyType: 'county',
      jurisdictionId: 'county:24510',
      boundaryVersion: 'county-2020',
      label: 'Baltimore city, MD (fixture)',
    },
    methodStance: 'juxtaposition',
    methodNote:
      'Indicators are placed next to redlining history for context. Juxtaposition is not causation.',
    observations: [
      {
        observationId: 'obs_fixture_homeownership_black',
        metricId: 'acs-homeownership-rate-black-county',
        estimate: 42.1,
        unit: 'percent',
        referencePeriod: '2018-2022',
        label: 'Black homeownership rate',
        provenance,
      },
    ],
    derived: [
      {
        derivedId: 'der_fixture_income_gap',
        methodId: 'black_white_income_gap',
        value: -18_400,
        unit: 'USD',
        status: 'derived',
        formula: 'median_hh_income_black - median_hh_income_white',
        inputObservationIds: ['obs_fixture_income_black', 'obs_fixture_income_white'],
        label: 'Black–White median household income gap',
        provenance: {
          ...provenance,
          contentHash: 'sha256:fixture-income-gap',
          humanCitation: 'Derived from ACS B19013B / B19013A (fixture).',
        },
      },
    ],
    artifacts: [
      {
        artifactId: 'art_fixture_holc_note',
        artifactClass: 'cartographic_grade_map',
        title: 'HOLC residential security map (fixture citation)',
        citation: 'Mapping Inequality / HOLC (fixture — rights review before commercial surface).',
        dated: '1937',
        uncertaintyLabel: 'Grade polygons are historical; modern boundaries differ.',
      },
    ],
    gapStates: ['insufficient_evidence'],
    status: 'draft',
    createdAt: '2026-07-22T15:00:00.000Z',
    updatedAt: '2026-07-22T15:00:00.000Z',
    ...overrides,
  });
}
