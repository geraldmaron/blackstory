/**
 * Site-wide "How to read this record" pre-bunking component forewarning plus
 * technique-based reader empowerment. Names manipulation techniques, never people or groups.
 */
import React from 'react';
import { Notice } from '@black-book/ui';
import { PREBUNK_TECHNIQUE_FRAMES } from '../../lib/trust/domain-trust.js';

export type HowToReadThisRecordProps = {
  readonly methodologyHref?: string;
};

export function HowToReadThisRecord({ methodologyHref = '/methodology' }: HowToReadThisRecordProps) {
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
      <ul className="bb-sans" style={{ margin: 'var(--bb-space-4) 0 0 0', paddingLeft: 'var(--bb-space-5)' }}>
        {PREBUNK_TECHNIQUE_FRAMES.map((frame) => (
          <li key={frame.id} style={{ marginBottom: 'var(--bb-space-3)' }}>
            <strong>{frame.technique}.</strong> {frame.readerAction}
          </li>
        ))}
      </ul>
      <p className="bb-sans" style={{ margin: 'var(--bb-space-4) 0 0 0' }}>
        <a href={methodologyHref}>Read our full methodology</a> for definitions, source hierarchy, and
        verification steps.
      </p>
    </section>
  );
}
