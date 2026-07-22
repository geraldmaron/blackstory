/**
 * launch gate inventory measurable machine checks plus fail-closed human attestations.
 */
import type { LaunchGateDefinition } from './types.js';

export const BETA_LAUNCH_GATES: readonly LaunchGateDefinition[] = [
  {
    id: 'published-claims-with-evidence',
    title: 'Published claims have qualifying evidence (100%)',
    kind: 'human',
    required: true,
    description:
      'Operator attests every published claim has qualifying evidence links per publication policy.',
    evidence: [
      {
        type: 'doc',
        ref: 'docs/runbooks/production-release.md',
        description: 'Release checklist references publication evidence review.',
      },
    ],
  },
  {
    id: 'unsupported-narrative-zero',
    title: 'Unsupported narrative statements (0)',
    kind: 'human',
    required: true,
    description: 'Operator attests no unsupported narrative statements appear on public surfaces.',
    evidence: [
      {
        type: 'file',
        ref: 'packages/domain/src/claims/publication.ts',
        description: 'Publication threshold helpers.',
      },
    ],
  },
  {
    id: 'living-addresses-zero',
    title: 'Living residential addresses displayed (0)',
    kind: 'human',
    required: true,
    description:
      'Operator attests zero living residential addresses are displayed; adversarial harness covers attempts.',
    evidence: [
      {
        type: 'command',
        ref: 'node --import tsx scripts/run-testing-layer.mjs security',
        description: 'Includes living-address adversarial scenarios ().',
      },
      {
        type: 'file',
        ref: 'packages/testing/src/adversarial-integrity/scenarios.ts',
      },
    ],
  },
  {
    id: 'untracked-publication-decisions-zero',
    title: 'Untracked publication decisions (0)',
    kind: 'human',
    required: true,
    description: 'Operator attests every publication decision is tracked in audit workflow.',
    evidence: [
      {
        type: 'file',
        ref: 'packages/config/src/scheduled-jobs/publish-guard.ts',
      },
    ],
  },
  {
    id: 'source-policy-violations-zero',
    title: 'Source-policy violations (0)',
    kind: 'human',
    required: true,
    description: 'Operator attests zero active source-policy violations in the release candidate.',
    evidence: [
      {
        type: 'file',
        ref: 'packages/domain/src/provenance',
        description: 'Source lineage and policy modules.',
      },
    ],
  },
  {
    id: 'gold-corpus-precision',
    title: 'High-impact claim precision target met (gold corpus)',
    kind: 'machine',
    required: true,
    description:
      'After predictions on the versioned gold corpus pass configured precision/recall thresholds.',
    evidence: [
      {
        type: 'file',
        ref: 'packages/testing/src/gold-corpus/fixtures/gold-corpus.v1.json',
      },
      {
        type: 'file',
        ref: 'packages/testing/src/gold-corpus/fixtures/predictions.after.v1.json',
      },
      {
        type: 'command',
        ref: 'node scripts/gold-corpus/eval.mjs evaluate --predictions packages/testing/src/gold-corpus/fixtures/predictions.after.v1.json',
      },
    ],
  },
  {
    id: 'restore-rehearsal-complete',
    title: 'Restore rehearsal complete ()',
    kind: 'machine',
    required: true,
    description:
      'Recovery rehearsal runner and last dry-run report fixtures are present and valid.',
    evidence: [
      {
        type: 'command',
        ref: 'node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only',
      },
      {
        type: 'artifact',
        ref: 'scripts/recovery-rehearsal/fixtures/last-rehearsal-report.json',
      },
      {
        type: 'command',
        ref: 'bash infra/github/release-pipeline/rollback-dry-run.sh 0000000000000000000000000000000000000001',
      },
    ],
  },
  {
    id: 'incident-exercise-complete',
    title: 'Incident exercise complete',
    kind: 'human',
    required: true,
    description: 'Operator attests tabletop or live incident exercise completed for beta launch.',
    evidence: [
      {
        type: 'doc',
        ref: 'docs/runbooks/incident-response.md',
      },
    ],
  },
  {
    id: 'load-abuse-verified',
    title: 'Load and abuse limits verified ()',
    kind: 'machine',
    required: true,
    description:
      'Load/abuse harness module and operator doc exist; scenario inventory is complete.',
    evidence: [
      {
        type: 'doc',
        ref: 'docs/testing/load-abuse.md',
      },
      {
        type: 'file',
        ref: 'packages/testing/src/load-abuse/scenarios.ts',
      },
      {
        type: 'command',
        ref: 'node --import tsx scripts/run-testing-layer.mjs security',
      },
    ],
  },
  {
    id: 'adversarial-integrity-verified',
    title: 'Adversarial integrity exercise ()',
    kind: 'machine',
    required: true,
    description: 'Adversarial integrity harness ships all required scenario ids.',
    evidence: [
      {
        type: 'doc',
        ref: 'docs/testing/adversarial-integrity.md',
      },
      {
        type: 'file',
        ref: 'packages/testing/src/adversarial-integrity/scenarios.ts',
      },
    ],
  },
  {
    id: 'methodology-corrections-available',
    title: 'Public methodology and correction process ()',
    kind: 'machine',
    required: true,
    description: 'Methodology, corrections, errata, and myths public surfaces exist in repo.',
    evidence: [
      {
        type: 'file',
        ref: 'apps/web/src/app/methodology/page.tsx',
      },
      {
        type: 'file',
        ref: 'apps/web/src/app/corrections/page.tsx',
      },
      {
        type: 'file',
        ref: 'apps/web/src/app/errata/page.tsx',
      },
    ],
  },
  {
    id: 'legal-privacy-review-tracked',
    title: 'Legal and privacy review issues tracked',
    kind: 'human',
    required: true,
    description:
      'Operator attests legal/privacy review findings are filed and tracked to resolution or waiver.',
    evidence: [
      {
        type: 'file',
        ref: 'packages/domain/src/legal/review-queue.ts',
      },
    ],
  },
  {
    id: 'disclaimer-framework-live',
    title: 'Disclaimer framework live on public surfaces ()',
    kind: 'machine',
    required: true,
    description: 'Versioned disclaimer registry module exists and ships tests.',
    evidence: [
      {
        type: 'file',
        ref: 'packages/domain/src/disclaimers.ts',
      },
      {
        type: 'file',
        ref: 'packages/domain/src/disclaimers.test.ts',
      },
    ],
  },
  {
    id: 'release-pipeline-ready',
    title: 'Production release pipeline ready ()',
    kind: 'machine',
    required: true,
    description: 'Release runbook, rollback dry-run script, and provenance schema are present.',
    evidence: [
      {
        type: 'doc',
        ref: 'docs/runbooks/production-release.md',
      },
      {
        type: 'file',
        ref: 'infra/github/release-pipeline/rollback-dry-run.sh',
      },
      {
        type: 'file',
        ref: 'infra/github/release-metadata/deployment-provenance.schema.json',
      },
    ],
  },
  {
    id: 'beta-disable-path-ready',
    title: 'Public beta disable / static read-only path documented',
    kind: 'machine',
    required: true,
    description: 'Kill-switch keys and Vercel env hooks exist; disable runbook is documented.',
    evidence: [
      {
        type: 'doc',
        ref: 'docs/launch/disable-public-beta.md',
      },
      {
        type: 'file',
        ref: 'packages/config/src/kill-switches.ts',
      },
      {
        type: 'file',
        ref: '.env.example',
        description: 'PUBLIC_READ_API_DISABLED documented for Vercel public web.',
      },
    ],
  },
] as const;

export type BetaLaunchGateId = (typeof BETA_LAUNCH_GATES)[number]['id'];

export const REQUIRED_HUMAN_GATE_IDS = BETA_LAUNCH_GATES.filter(
  (gate) => gate.kind === 'human' && gate.required,
).map((gate) => gate.id);
