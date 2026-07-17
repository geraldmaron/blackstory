
/**
 * Flaky-test quarantine registry. Quarantined tests must declare an owner and
 * deadline; expired entries fail closed instead of being retried forever.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type QuarantineEntry = {
  readonly id: string;
  readonly owner: string;
  readonly deadline: string;
  readonly reason: string;
  readonly issueUrl?: string;
};

export type QuarantineRegistry = {
  readonly version: number;
  readonly entries: readonly QuarantineEntry[];
};

export type QuarantineValidationIssue = {
  readonly id: string;
  readonly message: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function quarantineRegistryPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/quarantine or dist/quarantine → packages/testing/quarantine.json
  return join(here, '..', '..', 'quarantine.json');
}

export function loadQuarantineRegistry(
  path: string = quarantineRegistryPath(),
): QuarantineRegistry {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as QuarantineRegistry;
  return raw;
}

export function validateQuarantineRegistry(
  registry: QuarantineRegistry,
  now: Date = new Date(),
): QuarantineValidationIssue[] {
  const issues: QuarantineValidationIssue[] = [];
  const seen = new Set<string>();

  if (!Number.isInteger(registry.version) || registry.version < 1) {
    issues.push({ id: 'registry', message: 'version must be a positive integer' });
  }

  for (const entry of registry.entries ?? []) {
    if (!entry.id?.trim()) {
      issues.push({ id: 'unknown', message: 'quarantine entry missing id' });
      continue;
    }
    if (seen.has(entry.id)) {
      issues.push({ id: entry.id, message: 'duplicate quarantine id' });
    }
    seen.add(entry.id);

    if (!entry.owner?.trim()) {
      issues.push({ id: entry.id, message: 'owner is required' });
    }
    if (!entry.reason?.trim()) {
      issues.push({ id: entry.id, message: 'reason is required' });
    }
    if (!ISO_DATE.test(entry.deadline ?? '')) {
      issues.push({ id: entry.id, message: 'deadline must be YYYY-MM-DD' });
      continue;
    }

    const deadline = new Date(`${entry.deadline}T23:59:59.999Z`);
    if (Number.isNaN(deadline.valueOf())) {
      issues.push({ id: entry.id, message: 'deadline is not a valid date' });
      continue;
    }
    if (deadline.getTime() < now.getTime()) {
      issues.push({
        id: entry.id,
        message: `quarantine expired on ${entry.deadline}; fix or re-home the test`,
      });
    }
  }

  return issues;
}

export function assertQuarantineRegistryHealthy(
  registry: QuarantineRegistry = loadQuarantineRegistry(),
  now: Date = new Date(),
): void {
  const issues = validateQuarantineRegistry(registry, now);
  if (issues.length === 0) return;
  const details = issues.map((issue) => `- ${issue.id}: ${issue.message}`).join('\n');
  throw new Error(`Quarantine registry is unhealthy:\n${details}`);
}

export function isQuarantined(
  testId: string,
  registry: QuarantineRegistry = loadQuarantineRegistry(),
): QuarantineEntry | undefined {
  return registry.entries.find((entry) => entry.id === testId);
}
