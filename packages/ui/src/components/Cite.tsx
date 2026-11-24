/**
 * Cite: a disclosure that shows a record's citation in each style with a copy button
 * (docs/ui/DESIGN.md section 7.3). The strings are built by the caller (apps/web
 * `lib/citation/format.ts`); this only shows and copies them.
 *
 * It is a native `<details>`, so the citations are readable and selectable without JavaScript.
 * Copy puts plain text and, where the browser allows, italics on the clipboard.
 */

'use client';

import React, { useState } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

/** A citation as runs of text; `{ i }` is an italic run (a title or a site name). */
export type CitationPart = string | { readonly i: string };

export type CiteFormat = {
  /** "MLA", "APA", "Chicago". */
  readonly style: string;
  readonly parts: readonly CitationPart[];
};

export type CiteProps = {
  readonly formats: readonly CiteFormat[];
  /** The control's text. */
  readonly label?: string;
  readonly className?: string;
};

export function citationText(parts: readonly CitationPart[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.i)).join('');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function citationHtml(parts: readonly CitationPart[]): string {
  return parts
    .map((part) => (typeof part === 'string' ? escapeHtml(part) : `<i>${escapeHtml(part.i)}</i>`))
    .join('');
}

async function copyCitation(parts: readonly CitationPart[]): Promise<void> {
  const text = citationText(parts);
  // Rich copy keeps italics when pasted into a document; plain text is the fallback everywhere.
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([citationHtml(parts)], { type: 'text/html' }),
        }),
      ]);
      return;
    } catch {
      // fall through to plain text
    }
  }
  await navigator.clipboard.writeText(text);
}

export function Cite({ formats, label = 'Cite', className }: CiteProps) {
  const [copied, setCopied] = useState<string | null>(null);
  if (formats.length === 0) return null;
  return (
    <details className={cx('ds-cite', className)}>
      <summary className="ds-cite__toggle">{label}</summary>
      <div className="ds-cite__panel">
        {formats.map(({ style, parts }) => (
          <div key={style} className="ds-cite__format">
            <p className="ds-cite__style">{style}</p>
            <p className="ds-cite__text">
              {parts.map((part, index) =>
                typeof part === 'string' ? part : <i key={index}>{part.i}</i>,
              )}
            </p>
            <button
              type="button"
              className="ds-button ds-button--quiet ds-cite__copy"
              onClick={() => {
                copyCitation(parts).then(
                  () => setCopied(style),
                  () => setCopied(null),
                );
              }}
            >
              {copied === style ? 'Copied' : `Copy ${style}`}
            </button>
          </div>
        ))}
        <p className="ds-cite__status ds-visually-hidden" role="status">
          {copied ? `${copied} citation copied` : ''}
        </p>
      </div>
    </details>
  );
}
