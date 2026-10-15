/** Safe editorial errors distinguish conflicts from recoverable validation failures. */
import { ZodError } from '@repo/schemas';
import { authErrorResponse } from '../auth/request-auth';
import { StaffPermissionDeniedError } from '../auth/staff-permissions';
import { EditorialConflict } from './store';
export function editorialError(error: unknown): Response {
  if (error instanceof EditorialConflict)
    return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n') },
      { status: 400 },
    );
  if (error instanceof StaffPermissionDeniedError) return authErrorResponse(error);
  if (error instanceof Error && error.name.includes('Authorization'))
    return authErrorResponse(error);
  if (error instanceof Error && 'code' in error)
    return Response.json(
      { error: 'The database could not save this change. Your edits remain available.' },
      { status: 500 },
    );
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : 'The request failed. Your edits have not been discarded.',
    },
    { status: 400 },
  );
}
export async function editorialBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  let length = 0,
    text = '';
  const decoder = new TextDecoder();
  if (reader) {
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 1000000) {
          await reader.cancel();
          throw new Error('This article is too large to save.');
        }
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid article request.');
  return value as Record<string, unknown>;
}
