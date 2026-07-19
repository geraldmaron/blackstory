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
import { createAdminAtomicStore, createServerFirebaseApp } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';
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
  const shouldCommit = formData.get('commit') === 'on' || formData.get('commit') === '1';
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

    if (shouldCommit && outcome.fetch.ok && outcome.intake && outcome.intake.accepted) {
      const { app } = createServerFirebaseApp(process.env);
      const store = createAdminAtomicStore(getFirestore(app));
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
