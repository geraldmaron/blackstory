'use server';

/**
 * Server action for quick-add: prepare (and optionally commit) a research intake proposal.
 * Commit uses the same commitOperatorIntake + commitWithAudit path as operator-cli --commit.
 */
import { randomUUID } from 'node:crypto';
import {
  commitOperatorIntake,
  createNodeSafeFetchDependencies,
  runResearchIntake,
  type OperatorIntakeAccepted,
} from '@repo/operator-cli';
import { createPostgresAtomicStore } from '@repo/data-access';
import { getPostgresPool } from '../../../admin/lib/canonical-postgres-client';
import { readVerifiedAdminIdentity } from '../../../admin/auth/supabase-server';
import { staffRoleHasPermission } from '../../../admin/auth/staff-permissions';
import type { QuickAddFormState } from './form-state';

export async function submitQuickAdd(
  _previous: QuickAddFormState,
  formData: FormData,
): Promise<QuickAddFormState> {
  const identity = await readVerifiedAdminIdentity();
  if (!identity || !staffRoleHasPermission(identity.role, 'research:write')) {
    return { status: 'error', error: 'A staff session with research permission is required.' };
  }

  const url = String(formData.get('url') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const location = String(formData.get('location') ?? '').trim();
  const era = String(formData.get('era') ?? '').trim();
  const shouldCommit = formData.get('commit') === 'on' || formData.get('commit') === '1';
  const operatorId = identity.uid;
  const sessionId = randomUUID();

  if (!url) {
    return { status: 'error', error: 'A URL is required.' };
  }
  const privacyPepper = process.env.SUBMISSION_PRIVACY_PEPPER;
  if (!privacyPepper) {
    return {
      status: 'error',
      error:
        'Server is missing SUBMISSION_PRIVACY_PEPPER. Set it (see docs/runbooks/operator-session.md) before using quick-add.',
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

    if (shouldCommit && outcome.fetch.ok && outcome.intake && outcome.intake.accepted) {
      const store = createPostgresAtomicStore(getPostgresPool());
      const commitResult = await commitOperatorIntake(
        store,
        outcome.intake as OperatorIntakeAccepted,
      );
      return {
        status: 'committed',
        outcome,
        sessionId,
        auditEventId: commitResult.eventId,
        ...(outcome.intake.researchCase?.id
          ? { researchCaseId: outcome.intake.researchCase.id }
          : {}),
      };
    }

    return { status: 'result', outcome, sessionId };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}
