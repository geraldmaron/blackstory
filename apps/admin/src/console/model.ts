/**
 * Defines the administration console surfaces, fixture rows, and guarded action contracts.
 */
import type { AdminPermission, PrivilegedAdminAction } from '../auth/index';

export const CONSOLE_SURFACE_IDS = [
  'candidate-queue',
  'relevance-review',
  'entity-resolution',
  'sources',
  'research-cases',
  'evidence',
  'submissions',
  'publication',
  'retractions',
  'audit',
  'security-ops',
  'switches',
] as const;

export type ConsoleSurfaceId = (typeof CONSOLE_SURFACE_IDS)[number];

export type PublicationDiff = {
  readonly added: number;
  readonly changed: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly releaseCandidateId: string;
};

export type ConsoleAction = {
  readonly id: string;
  readonly label: string;
  readonly permission: AdminPermission;
  readonly endpoint: `/api/admin/${string}`;
  readonly destination: 'canonical-draft' | 'release-candidate';
  readonly publicationDiff: PublicationDiff;
  readonly privilegedAction?: PrivilegedAdminAction;
  readonly bulk?: {
    readonly maximumItems: number;
    readonly rollbackSupported: true;
  };
};

export type ConsoleFixtureRow = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly detail: string;
};

export type ConsoleSurface = {
  readonly id: ConsoleSurfaceId;
  readonly label: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly rows: readonly ConsoleFixtureRow[];
  readonly actions: readonly ConsoleAction[];
};
