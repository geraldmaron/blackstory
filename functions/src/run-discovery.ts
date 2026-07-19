/**
 * Shared discovery campaign runner for Firebase scheduled Functions.
 * Calls dispatchDiscoveryCampaign after resolving mode + kill switch. Never publishes.
 *
 * Soft catalog match is opt-in (`DISCOVERY_CATALOG_FROM=firestore`). Schedules default off
 * so hourly fixture crons do not page publicSearchIndex. Never hard-excludes known entities.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { dispatchDiscoveryCampaign, type DiscoveryCampaignDispatchResult } from '../../packages/config/src/scheduled-jobs/discovery-dispatcher.js';
import {
  DISCOVERY_CATALOG_PROFILE_DEFAULT_MAX,
  createFirestorePublicSearchIndexCatalogPager,
  loadDiscoveryCatalogProfiles,
} from '../../packages/firebase/src/discovery/catalog-profiles.js';
import type { KillSwitchDoc } from '../../packages/firebase/src/firestore/types.js';
import type { ResolutionProfile } from '../../packages/domain/src/resolution/types.js';
import { resolveResearchCampaignsKillSwitchEngaged } from './kill-switch-env.js';
import { parseDiscoveryMode } from './mode.js';

function ensureAdminApp(): void {
  if (getApps().length === 0) {
    initializeApp();
  }
}

async function readFirestoreKillSwitchDoc(
  path: string,
): Promise<{ exists: boolean; data: () => KillSwitchDoc | undefined }> {
  ensureAdminApp();
  const snap = await getFirestore().doc(path).get();
  return {
    exists: snap.exists,
    data: () => {
      if (!snap.exists) {
        return undefined;
      }
      return snap.data() as KillSwitchDoc;
    },
  };
}

function parseCatalogMax(raw: string | undefined): number {
  if (raw === undefined || raw.trim().length === 0) {
    return DISCOVERY_CATALOG_PROFILE_DEFAULT_MAX;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(
      `DISCOVERY_CATALOG_MAX must be a positive integer (got ${JSON.stringify(raw)})`,
    );
  }
  return parsed;
}

export type RunScheduledDiscoveryInput = {
  readonly jobId: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  /** Injected for unit tests; production uses Admin Firestore. */
  readonly readFirestoreDoc?: typeof readFirestoreKillSwitchDoc;
  /** Injected for unit tests; production loads publicSearchIndex when opt-in. */
  readonly loadCatalogProfiles?: () => Promise<{
    readonly profiles: readonly ResolutionProfile[];
    readonly catalogTitles: readonly string[];
    readonly truncated: boolean;
  }>;
};

async function resolveOptInCatalog(input: {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly loadCatalogProfiles?: RunScheduledDiscoveryInput['loadCatalogProfiles'];
}): Promise<{
  readonly catalogProfiles?: readonly ResolutionProfile[];
  readonly catalogTitles?: readonly string[];
  readonly catalogTruncated?: boolean;
}> {
  const from = input.environment.DISCOVERY_CATALOG_FROM?.trim().toLowerCase();
  if (from !== 'firestore') {
    return {};
  }

  const loaded =
    input.loadCatalogProfiles !== undefined
      ? await input.loadCatalogProfiles()
      : await (async () => {
          ensureAdminApp();
          const maxProfiles = parseCatalogMax(input.environment.DISCOVERY_CATALOG_MAX);
          const nowIso = input.environment.DISCOVERY_NOW_ISO?.trim();
          return loadDiscoveryCatalogProfiles({
            pager: createFirestorePublicSearchIndexCatalogPager(getFirestore()),
            maxProfiles,
            ...(nowIso !== undefined && nowIso.length > 0 ? { nowIso } : {}),
          });
        })();

  return {
    ...(loaded.profiles.length > 0 ? { catalogProfiles: loaded.profiles } : {}),
    ...(loaded.catalogTitles.length > 0 ? { catalogTitles: loaded.catalogTitles } : {}),
    catalogTruncated: loaded.truncated,
  };
}

/**
 * Resolve env + kill switch, then dispatch. Throws only on invalid env; dispatch errors
 * are returned as status error from the dispatcher.
 */
export async function runScheduledDiscovery(
  input: RunScheduledDiscoveryInput,
): Promise<DiscoveryCampaignDispatchResult> {
  const environment = input.environment ?? process.env;
  const mode = parseDiscoveryMode(environment.DISCOVERY_MODE);
  const killSwitchEngaged = await resolveResearchCampaignsKillSwitchEngaged({
    envValue: environment.DISCOVERY_KILL_SWITCH,
    readFirestoreDoc: input.readFirestoreDoc ?? readFirestoreKillSwitchDoc,
  });

  const jobRunId = environment.DISCOVERY_JOB_RUN_ID?.trim();
  const nowIso = environment.DISCOVERY_NOW_ISO?.trim();
  const catalog = await resolveOptInCatalog({
    environment,
    ...(input.loadCatalogProfiles !== undefined
      ? { loadCatalogProfiles: input.loadCatalogProfiles }
      : {}),
  });

  if (catalog.catalogTruncated === true) {
    console.info(
      JSON.stringify({
        event: 'discovery.catalog.truncated',
        max: parseCatalogMax(environment.DISCOVERY_CATALOG_MAX),
        loaded: catalog.catalogProfiles?.length ?? 0,
      }),
    );
  }

  return dispatchDiscoveryCampaign({
    jobId: input.jobId,
    mode,
    killSwitchEngaged,
    ...(jobRunId !== undefined && jobRunId.length > 0 ? { jobRunId } : {}),
    ...(nowIso !== undefined && nowIso.length > 0 ? { nowIso } : {}),
    environment,
    ...(catalog.catalogProfiles !== undefined
      ? { catalogProfiles: catalog.catalogProfiles }
      : {}),
    ...(catalog.catalogTitles !== undefined ? { catalogTitles: catalog.catalogTitles } : {}),
  });
}
