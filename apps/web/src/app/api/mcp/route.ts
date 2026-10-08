import { handleManagementMcp } from '@repo/operator-mcp';
import { authorizeAdminRequest } from '../../../admin/auth/request-auth';
import { POST as submit, GET as list } from '../../admin/api/work/route';
import { GET as get } from '../../admin/api/work/[id]/route';
import { POST as decide } from '../../admin/api/work/[id]/decisions/route';
import { POST as retry } from '../../admin/api/work/[id]/retry/route';

export const runtime = 'nodejs';
export async function POST(request: Request): Promise<Response> {
  try {
    const caller = await authorizeAdminRequest(request.headers);
    if (!caller.admin.clientId) throw new Error('An authorized OAuth client is required');
  } catch {
    return Response.json(
      { error: 'Authentication required' },
      {
        status: 401,
        headers: {
          'WWW-Authenticate':
            'Bearer resource_metadata="https://blackstory.app/.well-known/oauth-protected-resource/api/mcp"',
        },
      },
    );
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== 'https://blackstory.app')
    return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  return handleManagementMcp(request, async (path, body) => {
    const forwarded = new Request(`https://blackstory.app/admin/api/work${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: request.headers.get('authorization')!,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const [id, action] = path.split('/').filter(Boolean);
    let response: Response;
    if (!id) response = body === undefined ? await list(forwarded) : await submit(forwarded);
    else {
      const context = { params: Promise.resolve({ id }) };
      response =
        action === 'decisions'
          ? await decide(forwarded, context)
          : action === 'retry'
            ? await retry(forwarded, context)
            : await get(forwarded, context);
    }
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Work operation failed');
    return value;
  });
}
export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
