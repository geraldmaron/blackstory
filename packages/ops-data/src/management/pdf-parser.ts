/** Parse bounded PDF bytes without loading scripts or following document links. */
import { getDocumentProxy } from 'unpdf';
import type { SafeParserResult } from '@repo/security/url-safety';
export async function parseResearchPdf(content: Uint8Array): Promise<SafeParserResult> {
  if (new TextDecoder().decode(content.subarray(0, 5)) !== '%PDF-')
    return { safe: false, indicators: ['executable_magic'], extractedText: '' };
  const document = await getDocumentProxy(content, {
    useSystemFonts: false,
  });
  try {
    if (document.numPages > 300) throw new Error('PDF exceeds the research page limit');
    const started = Date.now();
    let extractedText = '';
    for (let index = 1; index <= document.numPages; index++) {
      if (Date.now() - started > 30000) throw new Error('PDF extraction exceeded its time limit');
      const page = await document.getPage(index);
      const text = await page.getTextContent();
      extractedText +=
        `[PDF page ${index}]\n` +
        text.items.map((item) => ('str' in item ? item.str : '')).join(' ') +
        '\n';
      page.cleanup();
      if (extractedText.length >= 100000) {
        extractedText =
          extractedText.slice(0, 100000) +
          '\n[Text limit reached; remaining content was not reviewed.]';
        break;
      }
    }
    return {
      safe: true,
      indicators: [],
      extractedText,
    };
  } finally {
    await document.loadingTask.destroy();
  }
}
