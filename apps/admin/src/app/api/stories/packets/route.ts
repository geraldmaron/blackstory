/**
 * API: list staged story_packet quarantine submissions for signed-in admins.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../auth/request-auth';
import { listStoryPackets } from '../../../../stories/story-packet-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '200');
    const items = await listStoryPackets(limit);
    return Response.json({
      items: items.map((item) => ({
        submissionId: item.submissionId,
        createdAt: item.createdAt,
        createdBy: item.createdBy,
        title: item.title,
        decision: item.decision,
        topicId: item.topicId,
        validationIssueCount: item.validationIssueCount,
        review: item.review ?? null,
        packet: item.packet,
      })),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('ECONNREFUSED') ||
        error.message.includes('Could not reach') ||
        error.message.includes('UNAVAILABLE') ||
        error.message.includes('DECODER') ||
        error.message.includes('Unable to detect'))
    ) {
      return Response.json(
        {
          error: 'Firestore unavailable. Start emulators or configure production ADC, then retry.',
          code: 'FIRESTORE_UNAVAILABLE',
        },
        { status: 503 },
      );
    }
    return authErrorResponse(error);
  }
}
