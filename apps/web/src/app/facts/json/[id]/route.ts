/**
 * Machine-readable fact export at `/facts/json/{id}` (rewritten from `/facts/{id}.json`).
 *
 * Serves CSL-JSON + extension block. Never ClaimReview. Human HTML lives at `/facts/{slug}`.
 */
import { NextResponse } from 'next/server';
import { buildFactPath } from '@repo/domain';
import { buildFactJsonExport } from '../../fact-json';
import { lookupPublicFact, parseFactIdParam } from '../../resolve-public-fact';

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const parsedId = parseFactIdParam(rawId);
  if (!parsedId) {
    return NextResponse.json({ error: 'invalid_fact_id' }, { status: 404 });
  }

  const resolved = lookupPublicFact(parsedId);
  if (resolved.kind === 'not_found' || resolved.kind === 'not_public') {
    return NextResponse.json({ error: 'fact_not_found' }, { status: 404 });
  }

  const fact = resolved.fact;
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildFactJsonExport(fact, origin), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Link: `<${buildFactPath(fact.id, fact.slug)}>; rel="canonical"`,
    },
  });
}
