/**
 * Browser-side "assign to me" call for a research case, shared by the queue sheet and the case
 * detail page so both send the same body and headers to
 * `POST /admin/api/research-cases/:id/assign` (requires `research:write`; the server answers 403
 * otherwise and its message is thrown for the caller's error area).
 */

/** The reason recorded when the reviewer did not write one. */
export const ASSIGN_TO_SELF_DEFAULT_REASON = 'Assigned to self';

export function buildAssignToMeBody(reason: string): { readonly reason: string } {
  return { reason: reason.trim() || ASSIGN_TO_SELF_DEFAULT_REASON };
}

/** The current assignee as the detail page shows it, or "Unassigned". */
export function assigneeLabel(
  assignment: { readonly reviewerId: string } | null | undefined,
): string {
  return assignment?.reviewerId ? assignment.reviewerId : 'Unassigned';
}

/** Assigns the case to the signed-in caller; throws with the server's message on failure. */
export async function assignCaseToMe(token: string, caseId: string, reason: string): Promise<void> {
  const response = await fetch(`/admin/api/research-cases/${caseId}/assign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildAssignToMeBody(reason)),
  });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Assign failed (${response.status})`);
}
