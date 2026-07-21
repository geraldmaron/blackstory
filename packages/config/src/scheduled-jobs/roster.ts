/**
 * Initial scheduled-job roster. Registry ENTRIES only most
 * job bodies belong to that are not built yet, or are being built in parallel by other
 * agents right now. Each entry's `rosterStatus` says plainly
 * whether it is wired to real, already-shipped code ('real') or is a documented stub a future
 * fills in ('stub'). See./jobs/ for the three real job bodies this wires directly.
 *
 * Cadence/budget/timeout numbers here are deliberately consistent with the numbers already
 * shipped in infra/gcp/cost-controls/cost-controls-matrix.json where a job's
 * work maps onto an existing cost-controlled category (e.g. research campaign candidate/day
 * caps); they are new, first-declared values for jobs that don't have a analog yet.
 */
import { EVENT_DRIVEN_CADENCE_SENTINEL } from './cron.js';
import { scheduledJobKillSwitchId } from './kill-switch.js';
import {
  createInMemoryScheduledJobRegistry,
  registerScheduledJob,
  type ScheduledJobRegistryStore,
} from './registry.js';
import type { ScheduledJobDefinition } from './types.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const QUARTER_MS = 91 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const RESEARCH_CAMPAIGNS_KILL_SWITCH = 'research-campaigns' as const;

export const DEFAULT_SCHEDULED_JOBS: readonly ScheduledJobDefinition[] = [
  // --- Discovery campaigns per adapter, grouped by the cadence class the describes.
  // One representative registry entry per class; fanning this out to one row per literal
  // adapter id (wikimedia, loc, nara, nps, dpla, school-history,...) is a cheap, purely
  // mechanical follow-up once land it needs zero framework changes.
  {
    id: 'discovery-campaign-wikimedia-federal',
    owner: 'discovery/wikimedia-federal',
    description:
      'Per-adapter discovery campaigns for Wikimedia and federal sources (LOC, NARA, NPS, DPLA, school-history) on their weekly-to-monthly cadences.',
    cadence: {
      cronExpression: '0 6 * * 1',
      nominalIntervalMs: WEEK_MS,
      humanReadable: 'weekly, Mondays 06:00 UTC',
    },
    budget: { unit: 'candidates', maxPerRun: 500 },
    timeoutSec: 3_600,
    idempotencyKeyScheme: 'job:{jobId}:{isoWeekStart}',
    killSwitchId: RESEARCH_CAMPAIGNS_KILL_SWITCH,
    targetWorker: {
      package: 'research',
      function: 'discovery.campaign.run_wikimedia_federal_campaign',
    },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    implementationOwnerBead: 'discovery/wikimedia-federal',
    consecutiveMissedRunThreshold: 2,
  },
  {
    id: 'discovery-campaign-rss',
    owner: 'discovery/rss',
    description:
      'Generic RSS/Atom discovery (excludes curated ABS by default). Private candidates only; never publishes.',
    cadence: { cronExpression: '0 * * * *', nominalIntervalMs: HOUR_MS, humanReadable: 'hourly' },
    budget: { unit: 'candidates', maxPerRun: 100 },
    timeoutSec: 900,
    idempotencyKeyScheme: 'job:{jobId}:{hourStart}',
    killSwitchId: RESEARCH_CAMPAIGNS_KILL_SWITCH,
    targetWorker: { package: 'research', function: 'discovery.campaign.run_rss_campaign' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    implementationOwnerBead: 'discovery/rss',
    consecutiveMissedRunThreshold: 6,
  },
  // --- REAL: curated community-feed obscurity lane (ABS + care policy). Weekly, not hourly —
  // editorial feeds change slowly; extra-care harvest + obscurity ranking is batch work.
  {
    id: 'community-obscurity-discovery',
    owner: 'discovery/community-obscurity',
    description:
      'Curated community RSS (The American Blackstory) with authority harvest + obscurity.v1 ranking. Private candidates only; never publishes.',
    cadence: {
      cronExpression: '0 10 * * 0',
      nominalIntervalMs: WEEK_MS,
      humanReadable: 'weekly, Sundays 10:00 UTC',
    },
    budget: { unit: 'candidates', maxPerRun: 100 },
    timeoutSec: 1_800,
    idempotencyKeyScheme: 'job:{jobId}:{isoWeekStart}',
    killSwitchId: RESEARCH_CAMPAIGNS_KILL_SWITCH,
    targetWorker: {
      package: 'research',
      function: 'discovery.campaign.run_community_obscurity_campaign',
    },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 2,
  },
  {
    id: 'discovery-campaign-archive-dpla',
    owner: 'discovery/archive-web',
    description:
      'Internet Archive + community DPLA v2 discovery (not federal dpla-items-v1). Private candidates only.',
    cadence: {
      cronExpression: '0 7 * * 2',
      nominalIntervalMs: WEEK_MS,
      humanReadable: 'weekly, Tuesdays 07:00 UTC',
    },
    budget: { unit: 'candidates', maxPerRun: 500 },
    timeoutSec: 3_600,
    idempotencyKeyScheme: 'job:{jobId}:{isoWeekStart}',
    killSwitchId: RESEARCH_CAMPAIGNS_KILL_SWITCH,
    targetWorker: { package: 'research', function: 'discovery.campaign.run_archive_dpla_campaign' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    implementationOwnerBead: 'discovery/archive-web',
    consecutiveMissedRunThreshold: 2,
  },
  {
    id: 'discovery-campaign-web-search',
    owner: 'discovery/archive-web',
    description:
      'Budget-gated web-search discovery (SearXNG preferred; Brave fallback). Fails closed without storageTermsConfirmed; see cost-controls-matrix.json.',
    cadence: {
      cronExpression: '30 8 * * *',
      nominalIntervalMs: DAY_MS,
      humanReadable: 'daily 08:30 UTC',
    },
    budget: { unit: 'requests', maxPerRun: 50 },
    timeoutSec: 3_600,
    idempotencyKeyScheme: 'job:{jobId}:{dayStart}',
    killSwitchId: RESEARCH_CAMPAIGNS_KILL_SWITCH,
    targetWorker: { package: 'research', function: 'discovery.campaign.run_web_search_campaign' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    implementationOwnerBead: 'discovery/archive-web',
    consecutiveMissedRunThreshold: 3,
  },

  // --- REAL: Reddit deletion-sync. Wired to @repo/domain's
  // Reddit deletion-sync sweep (sweepRedditPointerLiveness/applyRedditPointerPurge, which wrap
  // shared planDeletionSyncPurge/applyDeletionSyncPurge) via
  // ./jobs/reddit-deletion-sync.ts. Honors the contractual 48h deletion window
  // (packages/domain/src/rights/obligations.ts's reddit entry). The Reddit adapter itself still
  // ships DISABLED in the registry pending the Responsible Builder application (a HUMAN
  // STEP; see packages/domain/src/adapters/reddit/contract.ts) — this job can run against
  // whatever pointers are already stored (none, until that approval lands and the adapter is
  // flipped on) without waiting on that approval itself.
  {
    id: 'reddit-deletion-sync',
    owner: 'discovery/reddit-rights',
    description:
      'Reddit deletion-sync: honors the contractual 48h deletion window by re-checking liveness and purging deleted pointers (including snippets).',
    cadence: {
      cronExpression: '0 */6 * * *',
      nominalIntervalMs: 6 * HOUR_MS,
      humanReadable: 'every 6 hours',
    },
    budget: { unit: 'items', maxPerRun: 1_000 },
    timeoutSec: 1_800,
    idempotencyKeyScheme: 'job:{jobId}:{sixHourWindowStart}',
    killSwitchId: scheduledJobKillSwitchId('reddit-deletion-sync'),
    targetWorker: { package: 'research', function: 'reddit.deletion_sync.run' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 4,
  },

  // --- REAL: legal change monitoring. Fixture-first adapters propose
  // review_queue events (Congress.gov eCFR CourtListener LegiScan); humans dispose.
  // Live vendor keys (api.data.gov, LegiScan) remain a human follow-up tests stay offline.
  {
    id: 'legal-change-monitoring',
    owner: 'legal-change-monitoring',
    description:
      'Legal landscape change monitoring: propose review_queue events from free public sources; never auto-apply public writes.',
    cadence: {
      cronExpression: '0 8 * * *',
      nominalIntervalMs: DAY_MS,
      humanReadable: 'daily, 08:00 UTC',
    },
    budget: { unit: 'items', maxPerRun: 500 },
    timeoutSec: 1_800,
    idempotencyKeyScheme: 'job:{jobId}:{dayStart}',
    killSwitchId: scheduledJobKillSwitchId('legal-change-monitoring'),
    targetWorker: { package: 'research', function: 'legal.change_monitoring.run' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 2,
  },

  // --- REAL: citation link-health sweeps. Wired to @repo/domain's
  // citation link-health/repair-ladder logic via ./jobs/citation-link-health-sweep.ts. This is
  // one of the two pre-approved automatic public-facing exceptions (mechanical + reversible:
  // swap in an archived-copy URL only) confirmed still true of the job body: it auto-commits
  // only the wayback_swap/dead_mark steps and returns permanent-redirect/retroactive-SPN repairs
  // as proposals, never auto-applying them (see the job file's module doc for the exact scope).
  {
    id: 'citation-link-health-sweep',
    owner: 'citation-link-health',
    description:
      'Citation link-health sweeps; the only automatic write this job may make is repairing a dead link to an archived copy.',
    cadence: {
      cronExpression: '0 9 * * 3',
      nominalIntervalMs: WEEK_MS,
      humanReadable: 'weekly, Wednesdays 09:00 UTC',
    },
    budget: { unit: 'links', maxPerRun: 2_000 },
    timeoutSec: 3_600,
    idempotencyKeyScheme: 'job:{jobId}:{isoWeekStart}',
    killSwitchId: scheduledJobKillSwitchId('citation-link-health-sweep'),
    targetWorker: { package: 'security', function: 'url_safety.link_health.sweep_citations' },
    environment: 'repo-internal',
    publicEffect: 'link-repair-archived-copy',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 2,
  },

  // --- External dataset refresh checks.
  {
    id: 'external-dataset-refresh-fbi-hate-crime',
    owner: 'historic-safety',
    description: 'Checks for the FBI hate-crime annual statistics release.',
    cadence: {
      cronExpression: '0 6 1 10 *',
      nominalIntervalMs: YEAR_MS,
      humanReadable: 'annually, Oct 1 06:00 UTC',
    },
    budget: { unit: 'requests', maxPerRun: 10 },
    timeoutSec: 600,
    idempotencyKeyScheme: 'job:{jobId}:{yearStart}',
    killSwitchId: scheduledJobKillSwitchId('external-dataset-refresh-fbi-hate-crime'),
    targetWorker: { package: 'research', function: 'dataset_refresh.check_fbi_hate_crime' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'stub',
    implementationOwnerBead: 'historic-safety',
    consecutiveMissedRunThreshold: 1,
  },
  {
    id: 'external-dataset-refresh-tougaloo-mapping-inequality',
    owner: 'historic-safety',
    description: 'Checks for Tougaloo/Mapping Inequality dataset revisions.',
    cadence: {
      cronExpression: '0 6 1 */3 *',
      nominalIntervalMs: QUARTER_MS,
      humanReadable: 'quarterly, 1st 06:00 UTC',
    },
    budget: { unit: 'requests', maxPerRun: 10 },
    timeoutSec: 600,
    idempotencyKeyScheme: 'job:{jobId}:{quarterStart}',
    killSwitchId: scheduledJobKillSwitchId('external-dataset-refresh-tougaloo-mapping-inequality'),
    targetWorker: {
      package: 'research',
      function: 'dataset_refresh.check_tougaloo_mapping_inequality',
    },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'stub',
    implementationOwnerBead: 'historic-safety',
    consecutiveMissedRunThreshold: 1,
  },
  {
    id: 'external-dataset-refresh-banned-books',
    owner: 'banned-books',
    description:
      'Quarterly banned-books listing refresh: re-validate purchase links on the curated catalog, rebuild listing snapshot proposals. Never auto-publishes entities.',
    cadence: {
      cronExpression: '0 6 1 1,4,7,10 *',
      nominalIntervalMs: QUARTER_MS,
      humanReadable: 'quarterly, 1st 06:00 UTC (Jan/Apr/Jul/Oct)',
    },
    budget: { unit: 'requests', maxPerRun: 200 },
    timeoutSec: 1_800,
    idempotencyKeyScheme: 'job:{jobId}:{quarterStart}',
    killSwitchId: scheduledJobKillSwitchId('external-dataset-refresh-banned-books'),
    targetWorker: {
      package: 'research',
      function: 'dataset_refresh.refresh_banned_books_listing',
    },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 1,
  },

  // --- REAL: relevance/confidence recalibration report. Wired to
  // @repo/domain's relevance-feedback module (decision-log extraction, per-dimension
  // disagreement, query-pack effectiveness, source-tier precision, drift alarm) via
  // ./jobs/recalibration-report.ts. Report-only: proposal/approval/gold-corpus-gate for an
  // actual weight change is a separate, human-triggered path never part of this cron job.
  {
    id: 'relevance-confidence-recalibration-report',
    owner: 'relevance-feedback',
    description:
      'Monthly relevance/confidence recalibration report (proposal only, no auto-tuning).',
    cadence: {
      cronExpression: '0 5 1 * *',
      nominalIntervalMs: MONTH_MS,
      humanReadable: 'monthly, 1st 05:00 UTC',
    },
    budget: { unit: 'claims', maxPerRun: 50_000 },
    timeoutSec: 7_200,
    idempotencyKeyScheme: 'job:{jobId}:{monthStart}',
    killSwitchId: scheduledJobKillSwitchId('relevance-confidence-recalibration-report'),
    targetWorker: {
      package: 'research',
      function: 'confidence_engine.recalibration_report.generate',
    },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 1,
  },

  // --- REAL: source drift + adapter run-health checks. Wired to
  // @repo/domain's evaluateRunHealth via ./jobs/source-drift-run-health.ts.
  {
    id: 'source-drift-run-health-check',
    owner: 'adapter-run-health',
    description: 'Daily source-adapter record-count/schema drift and run-health checks.',
    cadence: {
      cronExpression: '0 4 * * *',
      nominalIntervalMs: DAY_MS,
      humanReadable: 'daily 04:00 UTC',
    },
    budget: { unit: 'adapters', maxPerRun: 50 },
    timeoutSec: 1_800,
    idempotencyKeyScheme: 'job:{jobId}:{dayStart}',
    killSwitchId: RESEARCH_CAMPAIGNS_KILL_SWITCH,
    targetWorker: { package: 'research', function: 'adapters.run_health.evaluate_run_health' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 2,
  },

  // --- REAL: gold-corpus regression. Wired to @repo/testing's
  // evaluateCorpus via ./jobs/gold-corpus-regression.ts.
  {
    id: 'gold-corpus-regression',
    owner: 'gold-corpus-regression',
    description: 'Nightly (and on-engine-change) gold-corpus regression evaluation; report-only.',
    cadence: {
      cronExpression: '0 3 * * *',
      nominalIntervalMs: DAY_MS,
      humanReadable: 'daily 03:00 UTC',
    },
    budget: { unit: 'examples', maxPerRun: 10_000 },
    timeoutSec: 1_800,
    idempotencyKeyScheme: 'job:{jobId}:{dayStart}',
    killSwitchId: scheduledJobKillSwitchId('gold-corpus-regression'),
    targetWorker: { package: 'research', function: 'testing.gold_corpus.evaluate_corpus' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 2,
  },

  // --- REAL: backup verification. Wired to scripts/backup-restore/
  // verify-restore.mjs via ./jobs/backup-verification.ts.
  // Disclosed ADR-007 gap: ADR-007 says worker code lives only in research/publication/
  // security. scripts/backup-restore/ predates that decision and lives outside all three
  // worker packages. targetWorker.package below is 'security' (closest fit ops/ops-adjacent
  // concerns already live there) as the *container* this job runs in; the script itself has not
  // moved. Migrating scripts/backup-restore's logic into workers/security is a reasonable
  // follow-up outside this module.
  {
    id: 'backup-verification-daily',
    owner: 'backup-verification',
    description:
      'Daily Firestore export verification (document counts, collection hashes, manifest checks).',
    cadence: {
      cronExpression: '0 5 * * *',
      nominalIntervalMs: DAY_MS,
      humanReadable: 'daily 05:00 UTC',
    },
    budget: { unit: 'exports', maxPerRun: 5 },
    timeoutSec: 900,
    idempotencyKeyScheme: 'job:{jobId}:{dayStart}',
    killSwitchId: scheduledJobKillSwitchId('backup-verification-daily'),
    targetWorker: { package: 'security', function: 'ops.backup_verification.verify_restore' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 2,
  },

  // --- REAL: restore-drill scheduling. Prompts the quarterly drill runbook
  // (docs/runbooks/backup-restore.md); scripts/backup-restore/staging-restore.stub.sh is
  // print-only by design (a human executes the printed gcloud import) that human gate is the
  // runbook's design, not a missing implementation here.
  {
    id: 'restore-drill-quarterly',
    owner: 'restore-drill',
    description:
      'Quarterly restore-drill scheduling; prints the staging-restore command for human execution.',
    cadence: {
      cronExpression: '0 6 1 1,4,7,10 *',
      nominalIntervalMs: QUARTER_MS,
      humanReadable: 'quarterly, 1st 06:00 UTC',
    },
    budget: { unit: 'drills', maxPerRun: 1 },
    timeoutSec: 600,
    idempotencyKeyScheme: 'job:{jobId}:{quarterStart}',
    killSwitchId: scheduledJobKillSwitchId('restore-drill-quarterly'),
    targetWorker: {
      package: 'security',
      function: 'ops.backup_verification.staging_restore_drill',
    },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 1,
  },

  // --- Cost/budget report. Stub: real evaluator (evaluateDailyBudget) lives
  // in packages/security/src/resource-controls.ts, not packages/config outside a "cheap to
  // wire" claim without adding @repo/security as a new dependency here, so this stays a
  // documented stub rather than a rushed wiring.
  {
    id: 'cost-budget-report',
    owner: 'degraded-mode',
    description:
      'Daily cost/budget report. Real evaluator already exists (packages/security/src/resource-controls.ts evaluateDailyBudget) but is not yet wired into a schedulable job body.',
    cadence: {
      cronExpression: '0 7 * * *',
      nominalIntervalMs: DAY_MS,
      humanReadable: 'daily 07:00 UTC',
    },
    budget: { unit: 'reports', maxPerRun: 1 },
    timeoutSec: 600,
    idempotencyKeyScheme: 'job:{jobId}:{dayStart}',
    killSwitchId: scheduledJobKillSwitchId('cost-budget-report'),
    targetWorker: { package: 'security', function: 'ops.cost_budget.generate_report' },
    environment: 'repo-internal',
    publicEffect: 'none',
    rosterStatus: 'stub',
    implementationOwnerBead: 'degraded-mode',
    consecutiveMissedRunThreshold: 2,
  },

  // --- Release-coupled rebuild. The second pre-approved automatic public-facing
  // exception: rebuilding a derived, regenerable artifact tied to an already-activated release.
  // Primarily release-activation-triggered (event-driven); the cadence below is the safety-net
  // poll, mirroring infra/firebase/backup/export-schedule.md's firestore-export-on-release entry.
  {
    id: 'release-coupled-rebuild',
    owner: 'map-platform',
    description:
      'Rebuilds map source tiles and the search index after a release activation. Event-driven; nominalIntervalMs below is the safety-net poll window.',
    cadence: {
      cronExpression: EVENT_DRIVEN_CADENCE_SENTINEL,
      nominalIntervalMs: HOUR_MS,
      humanReadable: 'on release activation (event-driven); hourly safety-net poll',
    },
    budget: { unit: 'rebuilds', maxPerRun: 3 },
    timeoutSec: 3_600,
    idempotencyKeyScheme: 'job:{jobId}:{releaseId}',
    killSwitchId: scheduledJobKillSwitchId('release-coupled-rebuild'),
    targetWorker: { package: 'publication', function: 'release.rebuild_map_and_search_index' },
    environment: 'repo-internal',
    publicEffect: 'release-coupled-rebuild',
    rosterStatus: 'stub',
    implementationOwnerBead: 'map-platform',
    consecutiveMissedRunThreshold: 6,
  },
];

export function createDefaultScheduledJobRegistry(): ScheduledJobRegistryStore {
  const store = createInMemoryScheduledJobRegistry();
  for (const definition of DEFAULT_SCHEDULED_JOBS) {
    registerScheduledJob(store, definition);
  }
  return store;
}
