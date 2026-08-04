/**
 * repo-n7p6.3 (WS3) — OCR quality scoring for captured evidence.
 *
 * NPS nomination forms are scans, OCR'd at varying quality by form vintage. The sampled 1999
 * form reads cleanly; the 1990 one renders "NPS Form" as "NFS Form" and drops characters mid
 * word ("individua properties and districts^ Sge losiiuctions"). A model handed that text will
 * not refuse — it will smooth the noise into confident prose and we will publish invented
 * history under a federal citation. So bad OCR is quarantined here, before it can reach WS4.
 *
 * The score is a deliberately boring bag of signals rather than anything clever: real English
 * prose has a stable ratio of letters to junk, a stable mean word length, and very few tokens
 * that mix letters with digits or punctuation. OCR damage moves all of those at once.
 *
 * Scoring is pure and unit-tested against real captured samples; the threshold is a policy
 * choice held in one place (QUARANTINE_BELOW) so it can be tuned from evidence rather than
 * scattered through the collectors.
 */

/** Evidence scoring at or above this is usable by WS4; below it is quarantined. */
export const QUARANTINE_BELOW = 0.62;

/** Below this many characters there is not enough prose to be worth enriching from. */
export const MIN_USABLE_CHARS = 400;

export type TextQualitySignals = {
  /** Share of characters that are letters, digits, spaces or ordinary punctuation. */
  readonly cleanCharRatio: number;
  /** Share of whitespace-split tokens that look like real words. */
  readonly wordlikeRatio: number;
  /** Mean length of word-like tokens. English prose sits near 4.5-5.5. */
  readonly meanWordLength: number;
  /** Share of tokens that are a single letter other than 'a'/'I' — a classic OCR shredding tell. */
  readonly orphanLetterRatio: number;
  readonly charCount: number;
};

const WORDLIKE_RE = /^[A-Za-z][A-Za-z'-]*$/u;
const CLEAN_CHAR_RE = /[A-Za-z0-9 .,;:'"()\-\n/&%$#]/u;

export function measureTextQuality(text: string): TextQualitySignals {
  const charCount = text.length;
  if (charCount === 0) {
    return {
      cleanCharRatio: 0,
      wordlikeRatio: 0,
      meanWordLength: 0,
      orphanLetterRatio: 1,
      charCount: 0,
    };
  }

  let cleanChars = 0;
  for (const char of text) if (CLEAN_CHAR_RE.test(char)) cleanChars += 1;

  const tokens = text.split(/\s+/u).filter((token) => token.length > 0);
  const wordlike = tokens.filter((token) => WORDLIKE_RE.test(token));
  const orphans = tokens.filter(
    (token) => token.length === 1 && /[A-Za-z]/u.test(token) && token !== 'a' && token !== 'A' && token !== 'I',
  );
  const totalWordLength = wordlike.reduce((sum, token) => sum + token.length, 0);

  return {
    cleanCharRatio: cleanChars / charCount,
    wordlikeRatio: tokens.length === 0 ? 0 : wordlike.length / tokens.length,
    meanWordLength: wordlike.length === 0 ? 0 : totalWordLength / wordlike.length,
    orphanLetterRatio: tokens.length === 0 ? 1 : orphans.length / tokens.length,
    charCount,
  };
}

/**
 * Fold signals into 0-1. Mean word length is scored as a distance from 5.0 rather than
 * "higher is better": both shredded text (mean ~2) and run-together text (mean ~12) are
 * damaged, and a one-sided score would wave one of them through.
 */
export function scoreTextQuality(signals: TextQualitySignals): number {
  if (signals.charCount === 0) return 0;
  const wordLengthFit = Math.max(0, 1 - Math.abs(signals.meanWordLength - 5) / 5);
  const orphanPenalty = Math.max(0, 1 - signals.orphanLetterRatio * 4);

  const score =
    signals.cleanCharRatio * 0.3 +
    signals.wordlikeRatio * 0.35 +
    wordLengthFit * 0.2 +
    orphanPenalty * 0.15;

  return Math.round(Math.min(1, Math.max(0, score)) * 1000) / 1000;
}

export type QualityVerdict = {
  readonly score: number;
  readonly signals: TextQualitySignals;
  readonly usable: boolean;
  readonly reason?: string;
};

export function assessText(text: string): QualityVerdict {
  const signals = measureTextQuality(text);
  const score = scoreTextQuality(signals);
  if (signals.charCount < MIN_USABLE_CHARS) {
    return { score, signals, usable: false, reason: `too short (${signals.charCount} chars)` };
  }
  if (score < QUARANTINE_BELOW) {
    return { score, signals, usable: false, reason: `ocr quality ${score} < ${QUARANTINE_BELOW}` };
  }
  return { score, signals, usable: true };
}
