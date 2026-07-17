
/**
 * Imports the execution plan into the repository's tracker.
 *
 * The script is intentionally idempotent: stable issue IDs and external references
 * let it update metadata/statuses without creating duplicate work items.
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const planPath = path.join(root, 'plan.md');
const sourcePdf = '/Users/geralddagher/Downloads/Black Book Web Application Execution Beads.pdf';

function runBd(args, { allowFailure = false } = {}) {
  const result = spawnSync('bd', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, BD_ACTOR: process.env.BD_ACTOR ?? 'construct-import' },
  });

  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `bd ${args.join(' ')} failed (${result.status}):\n${result.stderr || result.stdout}`,
    );
  }

  return result;
}

function issueId(externalRef) {
  return `black-book-bb${externalRef.slice(3)}`;
}

function parseRows(markdown) {
  const rows = [];

  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| BB-')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (!/^BB-\d{3}$/.test(cells[0] ?? '')) continue;

    const [externalRef, title, priority, size, dependencies, rawStatus, notes = ''] = cells;
    rows.push({
      externalRef,
      title,
      priority,
      size,
      dependencies,
      status: rawStatus.replaceAll('`', ''),
      notes,
    });
  }

  const unique = new Map(rows.map((row) => [row.externalRef, row]));
  if (rows.length !== 66 || unique.size !== 66) {
    throw new Error(`Expected 66 unique execution beads; found ${rows.length} rows / ${unique.size} IDs`);
  }

  return [...unique.values()].sort((a, b) => a.externalRef.localeCompare(b.externalRef));
}

function expandDependencies(value) {
  const dependencies = new Set();
  const pattern = /BB-(\d{3})(?:[–-](?:BB-)?(\d{3}))?/g;

  for (const match of value.matchAll(pattern)) {
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    for (let current = start; current <= end; current += 1) {
      dependencies.add(`BB-${String(current).padStart(3, '0')}`);
    }
  }

  return [...dependencies];
}

function trancheLabel(externalRef) {
  const number = Number(externalRef.slice(3));
  if (number <= 10) return 'tranche-1';
  if (number <= 20) return 'tranche-2';
  if (number >= 21 && number <= 36) return number === 31 ? 'deferred' : 'tranche-3';
  if ((number >= 37 && number <= 44) || number === 47) return 'tranche-4';
  if ((number >= 48 && number <= 50) || (number >= 52 && number <= 57)) return 'tranche-5';
  if ([45, 46].includes(number) || (number >= 58 && number <= 63)) return 'tranche-6';
  return 'deferred';
}

function descriptionFor(row) {
  const notes = row.notes ? `\n\nCurrent adaptation/status note: ${row.notes}` : '';
  return [
    `Execution bead ${row.externalRef} from the Black Book execution specification.`,
    '',
    `Source: ${sourcePdf}`,
    `Plan: plan.md`,
    `Size: ${row.size}`,
    `Dependencies: ${row.dependencies || 'None'}`,
    '',
    'Implement every Deliver item and satisfy every Acceptance item in the matching PDF section.',
    'Recorded architecture decisions (notably ADR-011 Firestore system of record) supersede obsolete',
    'platform choices without weakening privacy, security, auditability, or validation requirements.',
    notes,
  ]
    .join('\n')
    .trim();
}

const rows = parseRows(readFileSync(planPath, 'utf8'));
const existingResult = runBd(['list', '--all', '--limit', '0', '--json']);
const existing = JSON.parse(existingResult.stdout || '[]');
const existingIds = new Set(existing.map((issue) => issue.id));

for (const row of rows) {
  const id = issueId(row.externalRef);
  const labels = [
    'execution-bead',
    `size-${row.size.toLowerCase()}`,
    trancheLabel(row.externalRef),
    `plan-${row.status.replaceAll('_', '-')}`,
  ];
  const metadata = JSON.stringify({
    source: sourcePdf,
    sourceId: row.externalRef,
    planStatus: row.status,
    size: row.size,
    dependencyRefs: expandDependencies(row.dependencies),
  });
  const acceptance =
    `All Deliver and Acceptance requirements in ${row.externalRef} of the source PDF are met, ` +
    'validated, and reflected in plan.md and durable project documentation.';

  if (!existingIds.has(id)) {
    runBd([
      'create',
      '--id',
      id,
      '--title',
      `${row.externalRef}: ${row.title}`,
      '--external-ref',
      row.externalRef,
      '--priority',
      row.priority,
      '--type',
      'task',
      '--description',
      descriptionFor(row),
      '--acceptance',
      acceptance,
      '--labels',
      labels.join(','),
      '--metadata',
      metadata,
      '--silent',
    ]);
  } else {
    runBd([
      'update',
      id,
      '--title',
      `${row.externalRef}: ${row.title}`,
      '--external-ref',
      row.externalRef,
      '--priority',
      row.priority,
      '--description',
      descriptionFor(row),
      '--acceptance',
      acceptance,
      '--set-labels',
      labels.join(','),
      '--metadata',
      metadata,
    ]);
  }
}

for (const row of rows) {
  const id = issueId(row.externalRef);
  for (const dependency of expandDependencies(row.dependencies)) {
    const dependencyId = issueId(dependency);
    if (dependencyId === id) continue;
    const result = runBd(['dep', 'add', id, dependencyId], { allowFailure: true });
    const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
    if (result.status !== 0 && !combined.includes('already exists')) {
      throw new Error(`Failed to add dependency ${id} -> ${dependencyId}:\n${combined}`);
    }
  }
}

for (const row of rows) {
  const id = issueId(row.externalRef);
  if (row.status === 'done') {
    runBd(
      [
        'close',
        id,
        '--reason',
        'Completed before Beads migration; implementation and validation evidence are recorded in plan.md and the repository.',
      ],
      { allowFailure: true },
    );
  } else if (row.status === 'deferred') {
    runBd(['update', id, '--status', 'deferred']);
  } else if (row.status === 'partial' || row.status === 'in_progress') {
    runBd(['update', id, '--status', 'in_progress']);
  } else {
    runBd(['update', id, '--status', 'open']);
  }
}

runBd(['dolt', 'commit', '--message', 'Import BB-001 through BB-066 execution beads'], {
  allowFailure: true,
});

const finalIssues = JSON.parse(runBd(['list', '--all', '--limit', '0', '--json']).stdout || '[]');
const imported = finalIssues.filter((issue) => /^BB-\d{3}$/.test(issue.external_ref ?? ''));
const counts = imported.reduce((summary, issue) => {
  summary[issue.status] = (summary[issue.status] ?? 0) + 1;
  return summary;
}, {});

if (imported.length !== 66) {
  throw new Error(`Import verification failed: expected 66 execution beads, found ${imported.length}`);
}

process.stdout.write(
  `${JSON.stringify({ imported: imported.length, counts }, null, 2)}\n`,
);
