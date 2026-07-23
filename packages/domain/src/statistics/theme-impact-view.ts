/**
 * Theme-impact packet view model for public storytelling surfaces — maps domain
 * packets and fixture rows into display-ready strings with provenance quartet.
 */
import { resolveThemeImpactPolicyEras } from './theme-impact-policy-eras.js';
import {
  THEME_IMPACT_BINDING_PURPOSES,
  type ThemeImpactBindingPurpose,
  type ThemeImpactGapState,
  type ThemeImpactMethodStance,
  type ThemeImpactPacket,
  type ThemeImpactPacketArtifact,
  type ThemeImpactPacketDerived,
  type ThemeImpactPacketGeography,
  type ThemeImpactPacketObservation,
  type ThemeImpactProvenanceQuartet,
} from './theme-impact-packet.js';
import { getThemeImpactQuestion } from './theme-impact-questions.js';

export type ThemeImpactProvenanceView = {
  readonly source: string;
  readonly source_url: string;
  readonly retrieved_at: string;
  readonly content_hash: string;
  readonly humanCitation: string;
};

export type ThemeImpactPacketView = {
  readonly packetId?: string;
  readonly questionId: string;
  readonly themeId: string;
  readonly question: string;
  readonly policyEras: readonly {
    readonly id: string;
    readonly label: string;
    readonly span?: string;
  }[];
  readonly geography: {
    readonly unit: string;
    readonly label: string;
    readonly boundaryVersion?: string;
  };
  readonly methodStance: ThemeImpactMethodStance;
  readonly methodNote: string;
  readonly observationsSummary: string;
  readonly observations: readonly ThemeImpactObservationView[];
  readonly derived: readonly ThemeImpactDerivedView[];
  readonly artifacts: readonly ThemeImpactArtifactView[];
  readonly gapStates: readonly ThemeImpactGapState[];
  readonly dataSource?: 'live' | 'fixture';
};

export type ThemeImpactObservationView = {
  readonly id: string;
  readonly metricId?: string;
  readonly label: string;
  readonly value: string;
  readonly referencePeriod?: string;
  readonly provenance: ThemeImpactProvenanceView;
};

export type ThemeImpactDerivedView = {
  readonly id: string;
  readonly methodId: string;
  readonly label: string;
  readonly value: string;
  readonly provenance: ThemeImpactProvenanceView;
};

export type ThemeImpactArtifactView = {
  readonly id: string;
  readonly title: string;
  readonly artifactClass: string;
  readonly dateLabel?: string;
  readonly summary: string;
  readonly uncertaintyLabel?: string;
  readonly provenance?: ThemeImpactProvenanceView;
};

export function formatThemeImpactEstimate(estimate: number, unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'percent' || normalized === 'pct' || normalized === '%') {
    return `${estimate}%`;
  }
  if (normalized === 'usd') {
    const prefix = estimate < 0 ? '−$' : '$';
    return `${prefix}${Math.abs(estimate).toLocaleString('en-US')}`;
  }
  if (normalized === 'per_100k' || normalized === 'per 100k') {
    return `${estimate.toLocaleString('en-US')} per 100,000 residents`;
  }
  return `${estimate.toLocaleString('en-US')} ${unit}`;
}

function provenanceToView(p: ThemeImpactProvenanceQuartet): ThemeImpactProvenanceView {
  return {
    source: p.source,
    source_url: p.sourceUrl,
    retrieved_at: p.retrievedAt,
    content_hash: p.contentHash,
    humanCitation: p.humanCitation,
  };
}

function geographyUnit(geography: ThemeImpactPacketGeography): string {
  return geography.geographyType;
}

function geographyLabel(geography: ThemeImpactPacketGeography): string {
  if (geography.label?.trim()) return geography.label.trim();
  if (geography.jurisdictionId?.trim()) return geography.jurisdictionId.trim();
  return geography.geographyType;
}

function observationToView(row: ThemeImpactPacketObservation): ThemeImpactObservationView {
  return {
    id: row.observationId,
    metricId: row.metricId,
    label: row.label ?? row.metricId,
    value: formatThemeImpactEstimate(row.estimate, row.unit),
    referencePeriod: row.referencePeriod,
    provenance: provenanceToView(row.provenance),
  };
}

function derivedToView(row: ThemeImpactPacketDerived): ThemeImpactDerivedView {
  return {
    id: row.derivedId,
    methodId: row.methodId,
    label: row.label ?? row.methodId,
    value: formatThemeImpactEstimate(row.value, row.unit),
    provenance: provenanceToView(row.provenance),
  };
}

function artifactToView(row: ThemeImpactPacketArtifact): ThemeImpactArtifactView {
  return {
    id: row.artifactId,
    title: row.title,
    artifactClass: row.artifactClass,
    ...(row.dated !== undefined ? { dateLabel: row.dated } : {}),
    summary: row.summary ?? row.citation,
    ...(row.uncertaintyLabel !== undefined ? { uncertaintyLabel: row.uncertaintyLabel } : {}),
    provenance: provenanceToView(row.provenance),
  };
}

/** Map a domain ThemeImpactPacket into a public view model. */
export function themeImpactPacketToView(
  packet: ThemeImpactPacket,
  options?: { readonly dataSource?: 'live' | 'fixture' },
): ThemeImpactPacketView {
  const question =
    getThemeImpactQuestion(packet.questionId)?.question ?? packet.title;

  return {
    ...(options?.dataSource !== undefined ? { dataSource: options.dataSource } : {}),
    packetId: packet.id,
    questionId: packet.questionId,
    themeId: packet.themeId,
    question,
    policyEras: resolveThemeImpactPolicyEras(packet.policyEras),
    geography: {
      unit: geographyUnit(packet.geography),
      label: geographyLabel(packet.geography),
      ...(packet.geography.boundaryVersion
        ? { boundaryVersion: packet.geography.boundaryVersion }
        : {}),
    },
    methodStance: packet.methodStance,
    methodNote: packet.methodNote,
    observationsSummary: packet.summary,
    observations: packet.observations.map(observationToView),
    derived: packet.derived.map(derivedToView),
    artifacts: packet.artifacts.map(artifactToView),
    gapStates: [...packet.gapStates],
  };
}

/** Parse one published row from bb_reference.theme_impact_packets. */
export function parseThemeImpactPacketRow(row: {
  readonly id: string;
  readonly question_id: string;
  readonly theme_id: string;
  readonly title: string;
  readonly summary: string;
  readonly policy_eras: readonly string[];
  readonly geography: unknown;
  readonly method_stance: string;
  readonly method_note: string;
  readonly observations: unknown;
  readonly derived: unknown;
  readonly artifacts: unknown;
  readonly gap_states: readonly string[];
  readonly causal_claim_ids?: readonly string[] | null;
  readonly entity_id?: string | null;
  readonly binding_purpose?: 'map_panel' | 'story' | 'research' | 'mcp' | null;
  readonly status: string;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}): ThemeImpactPacket {
  const geography = row.geography as ThemeImpactPacketGeography;
  const toIso = (value: string | Date) =>
    value instanceof Date ? value.toISOString() : value;
  const causalClaimIds = row.causal_claim_ids?.filter((id) => id.trim()) ?? [];
  const bindingPurpose = THEME_IMPACT_BINDING_PURPOSES.includes(
    row.binding_purpose as ThemeImpactBindingPurpose,
  )
    ? (row.binding_purpose as ThemeImpactBindingPurpose)
    : undefined;

  return {
    kind: 'theme.impact.packet.v1',
    id: row.id,
    questionId: row.question_id,
    themeId: row.theme_id as ThemeImpactPacket['themeId'],
    title: row.title,
    summary: row.summary,
    policyEras: [...row.policy_eras],
    geography,
    methodStance: row.method_stance as ThemeImpactMethodStance,
    methodNote: row.method_note,
    observations: (row.observations as ThemeImpactPacket['observations']) ?? [],
    derived: (row.derived as ThemeImpactPacket['derived']) ?? [],
    artifacts: (row.artifacts as ThemeImpactPacket['artifacts']) ?? [],
    gapStates: [...row.gap_states] as ThemeImpactPacket['gapStates'],
    ...(causalClaimIds.length > 0 ? { causalClaimIds } : {}),
    ...(row.entity_id && bindingPurpose
      ? {
          entityBinding: {
            entityId: row.entity_id,
            purpose: bindingPurpose,
          },
        }
      : {}),
    status: row.status as ThemeImpactPacket['status'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
