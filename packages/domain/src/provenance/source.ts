/**
 * Source organizations, domains, adapters/policies, and kill-switch gates.
 * Snapshots are selective (never automatic full crawl). Disabled adapters cannot create candidates.
 */
import type { RightsPolicy } from './rights.js';
import { assertSourceClassification } from './classifications.js';

/** Snapshot policy: selective only — never automatic wholesale capture. */
export const SNAPSHOT_MODES = ['none', 'selective'] as const;

export type SnapshotMode = (typeof SNAPSHOT_MODES)[number];

export type SourceOrganization = {
  readonly id: string;
  readonly name: string;
  readonly homepageUrl?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SourceDomain = {
  readonly id: string;
  readonly organizationId: string;
  /** Normalized hostname without scheme (e.g. archives.gov). */
  readonly hostname: string;
  readonly verified?: boolean;
  readonly createdAt: string;
};

export type SourceAdapterPolicy = {
  /** Selective snapshots only; automatic full-site snapshots are forbidden. */
  readonly snapshotMode: SnapshotMode;
  readonly rights: RightsPolicy;
  readonly permittedClaimClasses?: readonly string[];
  readonly refreshSchedule?: string;
  readonly notes?: string;
};

/**
 * Registered source adapter (Firestore `evidenceSources`).
 * `adapterEnabled: false` is the primary kill switch; optional ops killSwitch may also block.
 */
export type EvidenceSource = {
  readonly id: string;
  readonly organizationId?: string;
  readonly domainIds?: readonly string[];
  readonly displayName: string;
  readonly classification: string;
  readonly adapterId: string;
  readonly stableIdScheme: string;
  readonly policy: SourceAdapterPolicy;
  /** When false, adapter must not create new candidates. */
  readonly adapterEnabled: boolean;
  /** Optional link to `killSwitches/{id}` for ops-level disable. */
  readonly killSwitchId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SourceItem = {
  readonly id: string;
  readonly sourceId: string;
  /** Stable identifier within the source's scheme (URL, ark, doi, local id). */
  readonly stableIdentifier: string;
  readonly canonicalUrl?: string;
  readonly title?: string;
  readonly classification?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SourceKillSwitchState = {
  readonly id: string;
  /** When true, the named kill switch is engaged (blocks the adapter). */
  readonly enabled: boolean;
};

export function assertSnapshotIsSelective(mode: SnapshotMode): void {
  if (mode !== 'none' && mode !== 'selective') {
    throw new Error(`Snapshot mode must be selective or none; got ${String(mode)}`);
  }
}

export function assertEvidenceSourceValid(source: Pick<EvidenceSource, 'classification' | 'policy'>): void {
  assertSourceClassification(source.classification);
  assertSnapshotIsSelective(source.policy.snapshotMode);
}

/**
 * A disabled source adapter (or engaged ops kill switch) cannot create new candidates.
 */
export function canSourceAdapterCreateCandidates(
  source: Pick<EvidenceSource, 'adapterEnabled' | 'killSwitchId'>,
  killSwitch?: SourceKillSwitchState | null,
): boolean {
  if (!source.adapterEnabled) {
    return false;
  }
  if (source.killSwitchId && killSwitch) {
    if (killSwitch.id !== source.killSwitchId) {
      throw new Error(
        `Kill switch id mismatch: source expects ${source.killSwitchId}, got ${killSwitch.id}`,
      );
    }
    if (killSwitch.enabled) {
      return false;
    }
  }
  return true;
}

export function assertSourceAdapterCanCreateCandidates(
  source: Pick<EvidenceSource, 'id' | 'adapterEnabled' | 'killSwitchId' | 'adapterId'>,
  killSwitch?: SourceKillSwitchState | null,
): void {
  if (!canSourceAdapterCreateCandidates(source, killSwitch)) {
    throw new Error(
      `Source adapter "${source.adapterId}" (${source.id}) is disabled and cannot create candidates`,
    );
  }
}

export function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase();
  if (!trimmed) {
    throw new Error('Hostname must be non-empty');
  }
  const withoutScheme = trimmed.replace(/^https?:\/\//, '').split('/')[0] ?? trimmed;
  const withoutPort = withoutScheme.split(':')[0] ?? withoutScheme;
  if (!withoutPort.includes('.')) {
    throw new Error(`Hostname looks invalid: ${hostname}`);
  }
  return withoutPort;
}
