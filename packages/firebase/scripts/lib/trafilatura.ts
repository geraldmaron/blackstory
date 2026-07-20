/**
 * TypeScript bridge to the Trafilatura extraction CLI (ADR-019 decision item
 * 5: Trafilatura is the standard main-text/metadata extractor for HTML
 * captures). Fetching/SSRF-safety stays in TS (safe-fetch.ts, per ADR-019
 * item 7); this only improves what happens to already-fetched HTML, replacing
 * the crude regex tag-strip with real main-content extraction (drops nav/
 * boilerplate/ads that the regex approach can't distinguish from content).
 *
 * Best-effort: if the Python worker isn't available or errors, callers fall
 * back to the regex-extracted text already returned by safe-fetch.ts — this
 * is a quality upgrade, never a hard dependency of the pipeline.
 */
import { spawn } from 'node:child_process';

const REPO_ROOT = new URL('../../../..', import.meta.url).pathname;
const EXTRACT_TIMEOUT_MS = 15_000;

export type TrafilaturaResult = { readonly text: string; readonly title?: string };

function runTrafilaturaProcess(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'uv',
      ['run', '--project', 'workers/research', 'python3', '-m', 'black_book_research.crawl.trafilatura_extract'],
      { cwd: REPO_ROOT, timeout: EXTRACT_TIMEOUT_MS },
    );
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`trafilatura_extract exited ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    child.stdin.end(input);
  });
}

/** Re-extracts main-text from raw HTML via Trafilatura. Returns undefined on any failure. */
export async function extractWithTrafilatura(html: string, url?: string): Promise<TrafilaturaResult | undefined> {
  try {
    const stdout = await runTrafilaturaProcess(JSON.stringify({ html, url }));
    const parsed = JSON.parse(stdout) as { text?: string; title?: string; error?: string };
    if (parsed.error || typeof parsed.text !== 'string' || parsed.text.trim().length < 50) return undefined;
    return { text: parsed.text, ...(parsed.title ? { title: parsed.title } : {}) };
  } catch {
    return undefined;
  }
}
