/**
 * Renders staged story research packets to a review PDF (HTML → Chrome headless).
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/export-story-packets-pdf.ts \
 *     --input /tmp/story-packets-staged.json \
 *     --output ~/Downloads/blackstory-new-stories-for-review.pdf
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { StoryResearchPacket } from '@repo/domain';

function parseArgs(argv: readonly string[]): { input: string; output: string } {
  let input = '/tmp/story-packets-staged.json';
  let output = `${process.env.HOME ?? ''}/Downloads/blackstory-new-stories-for-review.pdf`;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') input = String(argv[++i] ?? input);
    else if (arg === '--output') output = String(argv[++i] ?? output);
  }
  return { input, output: resolve(output) };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPacket(packet: StoryResearchPacket, index: number): string {
  const bodyHtml = packet.draft.body
    .map((section) => {
      const heading = section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : '';
      const paragraphs = section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
      return `${heading}${paragraphs}`;
    })
    .join('\n');

  const citeRows = packet.citeMap
    .map(
      (entry) =>
        `<tr><td><code>${escapeHtml(entry.sentenceId)}</code></td>` +
        `<td>${escapeHtml(entry.citeKind)}${entry.citeId ? ` · ${escapeHtml(entry.citeId)}` : ''}</td>` +
        `<td>${escapeHtml(entry.text.slice(0, 120))}${entry.text.length > 120 ? '…' : ''}</td></tr>`,
    )
    .join('\n');

  const issues =
    packet.validationIssues.length > 0
      ? `<ul>${packet.validationIssues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
      : '<p class="ok">None — recommend gate passed.</p>';

  return `
<section class="story">
  <h2>${index + 1}. ${escapeHtml(packet.draft.title)}</h2>
  <p class="meta"><strong>Topic:</strong> ${escapeHtml(packet.topicId)} ·
    <strong>Decision:</strong> ${escapeHtml(packet.decision)} ·
    <strong>Confidence:</strong> ${packet.confidence.toFixed(2)}</p>
  <p class="dek">${escapeHtml(packet.draft.dek)}</p>
  <p class="meta">${escapeHtml(packet.draft.eraLabel)} · ${escapeHtml(packet.draft.placeLabel)}</p>
  <p class="meta"><strong>Entities:</strong> ${escapeHtml(packet.relatedEntityIds.join(', ') || '—')}</p>
  <p class="meta"><strong>Facts:</strong> ${escapeHtml(packet.relatedFactIds.join(', ') || '—')}</p>
  <h3>Brief</h3>
  <p><strong>Thesis:</strong> ${escapeHtml(packet.brief.thesisQuestion)}</p>
  <p><strong>Conventional start:</strong> ${escapeHtml(packet.brief.conventionalStartLine)}</p>
  <p><strong>Relocated start:</strong> ${escapeHtml(packet.brief.relocatedStartLine)}</p>
  ${packet.brief.verificationRule ? `<p><strong>Verification:</strong> ${escapeHtml(packet.brief.verificationRule)}</p>` : ''}
  <h3>Draft body</h3>
  ${bodyHtml}
  <h3>Validation issues</h3>
  ${issues}
  <h3>Cite map (${packet.citeMap.length} entries)</h3>
  <table><thead><tr><th>Id</th><th>Cite</th><th>Text</th></tr></thead><tbody>${citeRows}</tbody></table>
</section>`;
}

function buildHtml(packets: readonly StoryResearchPacket[]): string {
  const stories = packets.map((packet, index) => renderPacket(packet, index)).join('\n<hr/>\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>BlackStory — new story packets for review</title>
  <style>
    @page { margin: 0.75in; }
    body { font-family: "Inter", "Helvetica Neue", sans-serif; color: #0A0A0A; background: #FBF8F2; line-height: 1.45; font-size: 11pt; }
    h1 { font-family: "Sora", sans-serif; font-size: 20pt; margin-bottom: 0.25em; }
    h2 { font-family: "Sora", sans-serif; font-size: 14pt; color: #8E4F2A; margin-top: 1.5em; }
    h3 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.04em; color: #6D675F; }
    .dek { font-family: "Source Serif 4", Georgia, serif; font-size: 12pt; }
    .meta { font-size: 9pt; color: #6D675F; }
    .ok { color: #8E4F2A; }
    table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 0.5em; }
    th, td { border: 1px solid #D7D0C4; padding: 4px 6px; vertical-align: top; text-align: left; }
    th { background: #F4EFE5; }
    hr { border: none; border-top: 1px solid #D7D0C4; margin: 2em 0; }
    .cover { margin-bottom: 2em; padding-bottom: 1em; border-bottom: 2px solid #B86B2A; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>BlackStory — new story packets for review</h1>
    <p class="meta">History, pinned to place. Staged story.research.packet.v1 proposals — not published.</p>
    <p class="meta">Generated ${escapeHtml(new Date().toISOString())} · ${packets.length} packets</p>
  </div>
  ${stories}
</body>
</html>`;
}

function htmlToPdf(htmlPath: string, pdfPath: string): void {
  const chromeCandidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  const chrome = chromeCandidates.find((path) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  });
  if (!chrome) {
    throw new Error('No headless Chrome/Chromium/Edge found for PDF export');
  }
  mkdirSync(dirname(pdfPath), { recursive: true });
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${pdfPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'inherit' },
  );
}

function main(): void {
  const { input, output } = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(readFileSync(input, 'utf8')) as {
    packets?: StoryResearchPacket[];
  };
  const packets = raw.packets ?? [];
  if (packets.length === 0) {
    throw new Error(`No packets in ${input}`);
  }
  const htmlPath = '/tmp/blackstory-story-packets-review.html';
  writeFileSync(htmlPath, buildHtml(packets));
  htmlToPdf(htmlPath, output);
  console.log(`PDF: ${output}`);
  console.log(`HTML: ${htmlPath}`);
}

main();
