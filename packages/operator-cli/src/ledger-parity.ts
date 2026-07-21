/**
 * Human parity checklist and SQL probes for Corsair overnight runs against the canonical ledger.
 * Two production-equivalent cycles must be observed before legacy Firestore orchestration retires.
 */
export type ParityCycleStatus = 'pending' | 'passed' | 'failed';

export type ParityChecklistItem = {
  readonly id: string;
  readonly label: string;
  readonly compareNotes: string;
  readonly query: string;
};

export type ParityCycleRecord = {
  readonly cycleId: 'cycle-1' | 'cycle-2';
  readonly status: ParityCycleStatus;
  readonly observedAt?: string;
  readonly observer?: string;
  readonly notes?: string;
};

export const DEFAULT_PARITY_CYCLES: readonly ParityCycleRecord[] = Object.freeze([
  { cycleId: 'cycle-1', status: 'pending' },
  { cycleId: 'cycle-2', status: 'pending' },
]);

export const LEDGER_PARITY_CHECKLIST: readonly ParityChecklistItem[] = Object.freeze([
  {
    id: 'run-rows',
    label: 'Run rows (mode, status, terminal_reason)',
    compareNotes:
      'Each overnight window should create bb_research.runs rows with terminal status, ' +
      'matching journal exit code and .cache/overnight-enrichment summary mode.',
    query: `-- parity: run rows since window start
SELECT id, mode, status, terminal_reason, started_at, completed_at, heartbeat_at
FROM bb_research.runs
WHERE started_at >= :window_start
ORDER BY started_at;`,
  },
  {
    id: 'run-costs',
    label: 'Run costs and query counters',
    compareNotes:
      'cost_usd, query_count, candidate_url_count, and capture_count should align with ' +
      'OpenRouter/Ollama usage in enrichment.env logs and artifact query totals.',
    query: `-- parity: run costs since window start
SELECT id, cost_usd, query_count, candidate_url_count, capture_count, relationship_hop_count
FROM bb_research.runs
WHERE started_at >= :window_start
ORDER BY started_at;`,
  },
  {
    id: 'heartbeats',
    label: 'Frontier heartbeats and lease completion',
    compareNotes:
      'runs.heartbeat_at should advance during long enrichment; leased frontier_tasks should ' +
      'reach succeeded/dead_letter without orphaned leases after service exit.',
    query: `-- parity: heartbeat and frontier terminal state
SELECT r.id AS run_id, r.heartbeat_at, r.status AS run_status,
       ft.id AS task_id, ft.status AS task_status, ft.leased_until, ft.completed_at
FROM bb_research.runs r
LEFT JOIN bb_research.frontier_tasks ft ON ft.case_id = r.case_id
WHERE r.started_at >= :window_start
ORDER BY r.started_at, ft.created_at;`,
  },
  {
    id: 'artifact-counts',
    label: 'Artifact and case lineage counts',
    compareNotes:
      'Compare bb_research.cases, artifacts, agent_activities, and model_invocations counts ' +
      'with prepare-only JSON under .cache/overnight-enrichment and any --commit quarantine rows.',
    query: `-- parity: artifact counts since window start
SELECT
  (SELECT count(*) FROM bb_research.cases c WHERE c.created_at >= :window_start) AS cases,
  (SELECT count(*) FROM bb_research.artifacts a WHERE a.created_at >= :window_start) AS artifacts,
  (SELECT count(*) FROM bb_research.agent_activities aa
     JOIN bb_research.runs r ON r.id = aa.run_id
    WHERE r.started_at >= :window_start) AS activities,
  (SELECT count(*) FROM bb_research.model_invocations mi
     JOIN bb_research.agent_activities aa ON aa.id = mi.activity_id
     JOIN bb_research.runs r ON r.id = aa.run_id
    WHERE r.started_at >= :window_start) AS model_invocations;`,
  },
  {
    id: 'intake-outbox',
    label: 'Quarantine intake and outbox (when commit enabled)',
    compareNotes:
      'When COMMIT_ENRICHMENT break-glass is used, bb_submissions.intake_items, bb_audit.events, ' +
      'and bb_ops.outbox_messages should mirror operator-cli commit summaries.',
    query: `-- parity: intake/outbox since window start
SELECT
  (SELECT count(*) FROM bb_submissions.intake_items i WHERE i.created_at >= :window_start) AS intake_items,
  (SELECT count(*) FROM bb_audit.events e WHERE e.created_at >= :window_start) AS audit_events,
  (SELECT count(*) FROM bb_ops.outbox_messages o WHERE o.created_at >= :window_start) AS outbox_messages;`,
  },
]);

export function parityChecklistMarkdown(
  cycles: readonly ParityCycleRecord[] = DEFAULT_PARITY_CYCLES,
): string {
  const lines: string[] = [
    '## Ledger parity cycles (human observation)',
    '',
    'Run after each production-equivalent overnight window on Corsair. Compare Postgres rows ' +
      'with journal output and `.cache/overnight-enrichment/` artifacts. Firestore shadow-read ' +
      'reconciliation is bounded history only — do not treat Firestore as SoR.',
    '',
    '| Cycle | Status | Observed at | Observer | Notes |',
    '|---|---|---|---|---|',
  ];
  for (const cycle of cycles) {
    lines.push(
      `| ${cycle.cycleId} | ${cycle.status.toUpperCase()} | ${cycle.observedAt ?? '—'} | ${cycle.observer ?? '—'} | ${cycle.notes ?? '—'} |`,
    );
  }
  lines.push('', '### Checklist probes', '');
  for (const item of LEDGER_PARITY_CHECKLIST) {
    lines.push(`#### ${item.label}`, '', item.compareNotes, '', '```sql', item.query, '```', '');
  }
  return lines.join('\n');
}
