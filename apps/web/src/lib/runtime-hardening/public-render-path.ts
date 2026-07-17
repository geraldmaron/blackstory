/**
 * Static guardrails for the public render path (BB-022).
 * Ensures app routes do not import DB/model clients — seed/snapshot data only.
 */

import { FORBIDDEN_PUBLIC_RENDER_IMPORTS } from './constants';

export { FORBIDDEN_PUBLIC_RENDER_IMPORTS };

export type PublicRenderPathFinding = {
  readonly file: string;
  readonly pattern: string;
  readonly snippet: string;
};

/** Scan source text for imports that must not appear on the public render path. */
export function collectPublicRenderPathFindings(
  filePath: string,
  source: string,
): PublicRenderPathFinding[] {
  const findings: PublicRenderPathFinding[] = [];
  for (const pattern of FORBIDDEN_PUBLIC_RENDER_IMPORTS) {
    if (!pattern.test(source)) continue;
    const match = source.match(pattern);
    findings.push({
      file: filePath,
      pattern: String(pattern),
      snippet: match?.[0] ?? pattern.source,
    });
  }
  return findings;
}

/** Fail closed when a public route module imports forbidden backends. */
export function assertPublicRenderPathSafe(filePath: string, source: string): void {
  const findings = collectPublicRenderPathFindings(filePath, source);
  if (findings.length === 0) return;
  const summary = findings.map((f) => `${f.file}: ${f.snippet}`).join('; ');
  throw new Error(`Public render path import violation: ${summary}`);
}
