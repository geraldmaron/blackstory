'use server';

/**
 * Server action for the quick-add surface. This is a thin caller: it reads form
 * fields, builds an `OperatorIntakeContext`, and calls the real
 * `runResearchIntake`/`createNodeSafeFetchDependencies` from `@repo/operator-cli` the
 * exact same package function the `research-intake` CLI command and
 * `.claude/skills/black-book/research-intake` call. No fetch, quarantine, or research-case
 * logic is reimplemented here.
 *
 * Known, documented gap (not faked): this action does not yet read a verified IAP + Firebase
 * administrator identity the way `apps/admin/src/auth/server-authorization.ts` expects no
 * route in this app wires that verification into a request handler yet (the console shell at
 * `/console` documents the same gap on its disabled action buttons). Until that lands, the
 * operator identifies themselves via the "Operator id" field below, and a fresh session id is
 * minted per submission. Swap `readOperatorIdentity` for a verified identity once a trusted
 * server handler exists see `createServerAdminAuthorizer` in `../../auth/server-authorization.ts`.
 *
 * This action never commits anything to Firestore it only *prepares* a draft (matching the
 * `/console` shell's "no live mutation handlers" convention). Committing happens through the
 * operator CLI's `--commit` flag, a distinct, explicit, auditable action.
 */
import { randomUUID } from 'node:crypto';
import { createNodeSafeFetchDependencies, runResearchIntake } from '@repo/operator-cli';
import type { QuickAddFormState } from './form-state';

function readOperatorIdentity(formData: FormData): { operatorId: string; sessionId: string } {
  const operatorId = String(formData.get('operatorId') ?? '').trim();
  return { operatorId, sessionId: randomUUID() };
}

export async function submitQuickAdd(
  _previous: QuickAddFormState,
  formData: FormData,
): Promise<QuickAddFormState> {
  const url = String(formData.get('url') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const location = String(formData.get('location') ?? '').trim();
  const era = String(formData.get('era') ?? '').trim();
  const { operatorId, sessionId } = readOperatorIdentity(formData);

  if (!url) {
    return { status: 'error', error: 'A URL is required.' };
  }
  if (!operatorId) {
    return { status: 'error', error: 'An operator id is required to stamp this proposal.' };
  }
  const privacyPepper = process.env.OPERATOR_CLI_PRIVACY_PEPPER;
  if (!privacyPepper) {
    return {
      status: 'error',
      error:
        'Server is missing OPERATOR_CLI_PRIVACY_PEPPER. Set it (see docs/runbooks/operator-session.md) before using quick-add.',
    };
  }

  try {
    const outcome = await runResearchIntake(
      {
        url,
        ...(description ? { description } : {}),
        ...(location ? { location } : {}),
        ...(era ? { era } : {}),
      },
      {
        identity: { operatorId, sessionId, source: 'admin_console' },
        privacyPepper,
      },
      createNodeSafeFetchDependencies(),
    );
    return { status: 'result', outcome, sessionId };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}
