'use client';

import Link from 'next/link';
import React, { useId, useState } from 'react';
import type { LivesTurn as LivesTurnContent } from '../../lib/lives/lives-turns';

/**
 * One question, a native radio group, and the record behind the answer.
 *
 * The reader's choice lives in this component's memory and nowhere else: nothing is stored,
 * logged, sent, scored or tallied, and no other reader's answer is ever shown
 * (docs/research/lives-structure-decision.md §5). Native radios give keyboard and screen-reader
 * operation for free; the reveal is a polite live region so the answer is announced when it
 * appears. The answer is the same text whatever was chosen: a Turn reveals the record, it does not
 * mark the reader.
 */
export function LivesTurn({ turn }: { readonly turn: LivesTurnContent }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const name = useId();
  return (
    <section className="lives-turn" aria-label="A question before the record">
      <fieldset className="lives-turn__question">
        <legend>{turn.prompt}</legend>
        <div className="lives-turn__options">
          {turn.options.map((option) => (
            <label key={option.id} className="lives-turn__option">
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={chosen === option.id}
                onChange={() => setChosen(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="lives-turn__reveal" aria-live="polite">
        {chosen ? (
          <>
            <p>{turn.reveal}</p>
            {turn.records.length > 0 || (turn.citations?.length ?? 0) > 0 ? (
              <p className="lives-turn__records">
                From the record:{' '}
                {turn.records.map((record, index) => (
                  <React.Fragment key={record.href}>
                    {index > 0 ? ' · ' : null}
                    <Link href={record.href}>{record.label}</Link>
                  </React.Fragment>
                ))}
                {(turn.citations ?? []).map((source, index) => (
                  <React.Fragment key={source.url}>
                    {index > 0 || turn.records.length > 0 ? ' · ' : null}
                    <a href={source.url} rel="noopener noreferrer">
                      {source.label}
                    </a>
                  </React.Fragment>
                ))}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
