/**
 * Site-wide "How to read this record" pre-bunking component. Full variant: technique-based
 * reader empowerment (names manipulation techniques, never people or groups). Compact variant:
 * one-line methodology off-ramp for entity pages where trust pedagogy must not precede the story.
 */
import React from 'react';
import Link from 'next/link';
import { Notice } from '@repo/ui';
import { PREBUNK_TECHNIQUE_FRAMES } from '../../lib/trust/domain-trust';

export type HowToReadThisRecordProps = {
  readonly methodologyHref?: string;
  /** Compact = single methodology link; full = technique list + notice (default). */
  readonly variant?: 'full' | 'compact';
};

export function HowToReadThisRecord({
  methodologyHref = '/methodology',
  variant = 'full',
}: HowToReadThisRecordProps) {
  if (variant === 'compact') {
    return (
      <p className="ds-entity-trust-offramp ds-sans">
        How this record is built —{' '}
        <Link href={methodologyHref}>read the methodology</Link> for source hierarchy, confidence,
        and verification steps.
      </p>
    );
  }

  return (
    <section aria-labelledby="how-to-read-heading">
      <Notice tone="dispute" title="How to read this record">
        <p id="how-to-read-heading" style={{ margin: 0 }}>
          Historical records get challenged in predictable ways — quoting a source out of context,
          demanding a single &ldquo;official&rdquo; document for events that were deliberately never
          documented, or attacking the messenger instead of the evidence. Here is how this record is
          built so you can check it yourself.
        </p>
      </Notice>
      <ul className="ds-sans" style={{ margin: 'var(--ds-space-4) 0 0 0', paddingLeft: 'var(--ds-space-5)' }}>
        {PREBUNK_TECHNIQUE_FRAMES.map((frame) => (
          <li key={frame.id} style={{ marginBottom: 'var(--ds-space-3)' }}>
            <strong>{frame.technique}.</strong> {frame.readerAction}
          </li>
        ))}
      </ul>
      <p className="ds-sans" style={{ margin: 'var(--ds-space-4) 0 0 0' }}>
        <Link href={methodologyHref}>Read our full methodology</Link> for definitions, source hierarchy, and
        verification steps.
      </p>
    </section>
  );
}
