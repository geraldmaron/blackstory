/**
 * /ai.txt. An emerging, AI-specific complement to /robots.txt that a
 * subset of AI-training crawlers check independently of the standard robots convention. Same
 * caveat as robots.ts: this is a courtesy signal, not an access control real enforcement lives
 * in rate limits App Check cache-busting normalization (docs/security/threat-model.md T-19).
 * Reuses the single AI_TRAINING_USER_AGENTS list from the traffic-class agent
 * lists so /robots.txt, /ai.txt, and the classifier cannot drift.
 */
import { AI_TRAINING_USER_AGENTS } from '../../lib/traffic-class/agent-lists';

function buildAiTxt(): string {
  const lines = [
    '# ai.txt — BlackStory AI-crawler notice',
    '# This is a courtesy signal only; see /robots.txt for the standard-convention equivalent.',
    '#',
    "# License: BlackStory's own written content (articles, summaries, analysis) is licensed",
    '# under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/',
    '# CC BY 4.0 permits AI training and other reuse. Attribution required: credit "BlackStory"',
    '# and link back to the original page when you reuse this content.',
    '#',
    "# Scope: this license covers BlackStory's own writing only. It does not cover the",
    '# third-party photographs, documents, book covers, and map data displayed alongside it;',
    '# those carry their own terms, credited per record. Sources on this site include',
    '# Wikimedia Commons, Open Library, Internet Archive, USGS, and OpenStreetMap/OpenMapTiles.',
    '#',
    '# What the Disallow lines below mean, since the license above permits training: they are',
    '# about HOW you obtain this content, not whether you may use it. Crawling the whole',
    '# archive to assemble a corpus costs a one-person project real bandwidth, and the crawl',
    '# is the objection, not the training. Ask for bulk access instead, via the address in',
    '# /.well-known/security.txt, and the answer is expected to be yes.',
    '',
    ...AI_TRAINING_USER_AGENTS.flatMap((userAgent) => [
      `User-Agent: ${userAgent}`,
      'Disallow: /',
      '',
    ]),
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
