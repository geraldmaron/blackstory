import assert from 'node:assert/strict';
import test from 'node:test';
import { parseResearchPdf } from './pdf-parser.js';

function pdf(pages: readonly string[]): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...pages.flatMap((text, i) => {
      const stream = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      ];
    }),
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const offset = Buffer.byteLength(body);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

test('PDF research reads later pages and keeps locators attached', async () => {
  const result = await parseResearchPdf(
    pdf(['Collection index', 'The school opened in September 1924.']),
  );
  assert.equal(result.safe, true);
  assert.match(result.extractedText, /\[PDF page 2\]\nThe school opened in September 1924\./u);
});
test('PDF research rejects disguised files and excessive page counts', async () => {
  assert.equal((await parseResearchPdf(new TextEncoder().encode('MZ executable'))).safe, false);
  await assert.rejects(parseResearchPdf(pdf(Array.from({ length: 301 }, () => ''))), /page limit/);
});
