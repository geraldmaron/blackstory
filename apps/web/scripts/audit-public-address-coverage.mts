#!/usr/bin/env node
/**
 * Audit visitable release entities for weak public address lines.
 * Run from apps/web with development export conditions.
 */
import { auditPublicAddressCoverage } from '../src/lib/geography/public-address.ts';
import { listPublicEntities } from '../src/data/public-seed.ts';

const entities = listPublicEntities();
const issues = auditPublicAddressCoverage(entities, (entity) => entity.id);

console.log(`Audited ${entities.length} seed entities; ${issues.length} address issues.\n`);

const byKind = new Map<string, number>();
for (const issue of issues) {
  byKind.set(issue.issue, (byKind.get(issue.issue) ?? 0) + 1);
}

for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${kind}: ${count}`);
}

if (issues.length > 0) {
  console.log('\nIssues (first 40):\n');
  for (const issue of issues.slice(0, 40)) {
    console.log(
      `- ${issue.entityId} (${issue.kind}) [${issue.issue}]\n` +
        `  ${issue.displayName}\n` +
        `  label: ${issue.locationLabel}\n` +
        `  precision: ${issue.locationPrecision}\n` +
        `  action: ${issue.suggestedAction}\n`,
    );
  }
  if (issues.length > 40) {
    console.log(`… and ${issues.length - 40} more.`);
  }
}
