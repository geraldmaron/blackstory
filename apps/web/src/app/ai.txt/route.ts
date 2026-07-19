/**
 * /ai.txt. An emerging, AI-specific complement to /robots.txt that a
 * subset of AI-training crawlers check independently of the standard robots convention. Same
 * caveat as robots.ts: this is a courtesy signal, not an access control real enforcement lives
 * in rate limits App Check cache-busting normalization (docs/security/threat-model.md T-19).
 * Reuses the single AI_TRAINING_USER_AGENTS list from../robots.ts so the two files can never
 * drift out of sync.
 */
import { AI_TRAINING_USER_AGENTS } from '../robots';

function buildAiTxt(): string {
  const lines = [
    '# ai.txt — BlackStory AI-crawler policy ',
    '# This is a courtesy signal only; see /robots.txt for the standard-convention equivalent.',
    '# Content here is human-researched historical documentation, not a corpus offered for',
    '# unrestricted AI-training ingestion. Contact the security contact in',
    '# /.well-known/security.txt for licensing or bulk-access questions.',
    '',
    ...AI_TRAINING_USER_AGENTS.flatMap((userAgent) => [`User-Agent: ${userAgent}`, 'Disallow: /', '']),
  ];
  return lines.join('\n');
}

export function GET(): Response {
  return new Response(buildAiTxt(), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
