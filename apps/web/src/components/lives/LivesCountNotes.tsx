import React from 'react';
import { LIVES_LENS_LABELS, type LivesCountNote } from '@repo/domain/statistics/lives';

void React;

export type LivesCountNotesProps = {
  readonly notes: readonly LivesCountNote[];
  readonly decadeLabel: string;
};

/**
 * What the count could see: who the census counted in this decade, how, what it could not see, and what
 * that meant. Missing figures elsewhere on the page link here.
 */
export function LivesCountNotes({ notes, decadeLabel }: LivesCountNotesProps) {
  if (notes.length === 0) return null;
  return (
    <section className="lives-count" aria-labelledby="lives-count-heading">
      <h3 id="lives-count-heading">What the count could see in the {decadeLabel}</h3>
      <ul className="lives-count__list">
        {notes.map((note) => (
          <li key={note.id} id={`lives-note-${note.id}`} className="lives-count__note">
            <p className="lives-count__heading">{note.heading}</p>
            <p className="lives-count__groups">
              {note.appliesTo.includes('all')
                ? 'Everyone'
                : note.appliesTo
                    .filter((lens): lens is Exclude<typeof lens, 'all'> => lens !== 'all')
                    .map((lens) => LIVES_LENS_LABELS[lens])
                    .join(', ')}
            </p>
            <p>{note.body}</p>
            <p className="lives-count__sources">
              {note.citations.map((citation, index) => (
                <React.Fragment key={citation.url}>
                  {index > 0 ? ' · ' : 'Source: '}
                  <a href={citation.url} rel="noreferrer">
                    {citation.label}
                  </a>
                </React.Fragment>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
