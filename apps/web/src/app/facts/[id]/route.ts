/**
 * Content-negotiated JSON export and canonical slug redirect for `/facts/{id}` and
 * `/facts/{id}.json` (BB-086 AC3/AC6).
 */
import { NextResponse } from 'next/server';
import { buildFactPath, slugifyFactStatement } from '@black-book/domain';
import { buildFactJsonExport } from '../fact-json';
import { parseFactIdParam, resolvePublicFact } from '../resolve-public-fact';

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const parsedId = parseFactIdParam(rawId);
  if (!parsedId) {
    return NextResponse.json({ error: 'invalid_fact_id' }, { status: 404 });
  }

  const wantsJson =
    rawId.endsWith('.json') ||
    request.headers.get('accept')?.includes('application/json') === true ||
    new URL(request.url).searchParams.get('format') === 'json';

  const resolved = resolvePublicFact(parsedId);
  if (resolved.kind === 'not_found' || resolved.kind === 'not_public') {
    return NextResponse.json({ error: 'fact_not_found' }, { status: 404 });
  }
  if (resolved.kind === 'redirect') {
    return NextResponse.redirect(new URL(resolved.destination, request.url), 307);
  }

  const fact = resolved.fact;

  if (wantsJson) {
    const origin = new URL(request.url).origin;
    return NextResponse.json(buildFactJsonExport(fact, origin), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Link: `<${buildFactPath(fact.id, slugifyFactStatement(fact.shortStatement))}>; rel="canonical"`,
      },
    });
  }

  return NextResponse.redirect(
    new URL(buildFactPath(fact.id, slugifyFactStatement(fact.shortStatement)), request.url),
    307,
  );
}
