/**
 * Memorial edition list section. The opening screen is the wall plus the room
 * header (see page.tsx); this renders the full alphabetical list, which starts
 * below the fold and is the accessible, readable record of the same names.
 */
import React from 'react';
import Link from 'next/link';
import {
  memorialNameYear,
  memorialNamesByInitial,
} from '../../components/patterns/memorial-wall/memorial-names';
import { MEMORIAL_LIST_NOTE } from './memorial-copy';
import { MemorialListContrastZone } from './MemorialListContrastZone';

void React;

export type MemorialSectionsProps = {
  /**
   * Name -> entity id, for the names this archive also holds a record of.
   *
   * A name in this map renders as a link to that record; a name absent from it renders as plain
   * text, and the sentence above the list says so in words (design-direction-v9-surfaces.md §4,
   * /memorial: "Names are links where a record exists and plain text where none does, and the
   * difference is stated in words, never implied by color alone").
   *
   * DELIBERATELY EMPTY TODAY, and that is a decision rather than an omission. `MEMORIAL_NAMES`
   * is a list of strings with no entity ids, so populating this would mean matching a murdered
   * person to a record by their name. Two people share a name often enough that the failure mode
   * is attributing one person's killing to another person's record, on the one surface where
   * that is least forgivable. The rendering rule ships here; the join is repo-92n2.30's
   * follow-up and needs verified per-name evidence, not a string match.
   */
  readonly entityLinksByName?: Readonly<Record<string, string>>;
};

/** DOM id for a letter group, shared by its heading and the jump rail link. */
const groupId = (letter: string) => `memorial-names-${letter === '#' ? 'other' : letter}`;

export function MemorialSections({ entityLinksByName = {} }: MemorialSectionsProps = {}) {
  const groups = memorialNamesByInitial();
  const total = groups.reduce((count, group) => count + group.names.length, 0);
  // The sentence is shown when the difference it explains actually exists on the page. With no
  // name linked there is no difference to explain, and stating one would describe a distinction
  // the reader cannot see.
  const anyLinked = groups.some((group) => group.names.some((name) => entityLinksByName[name]));

  return (
    <MemorialListContrastZone>
      {/*
        No panel, no numeral, no kicker. This list is not section 01 of a publication and it is
        not a card: it is the names, and every frame drawn around them was chrome asserting
        itself over them. What is left is a heading, a count, and the list.
      */}
      <article
        className="ds-memorial__list"
        aria-labelledby="memorial-names-heading"
        id="memorial-names"
        tabIndex={-1}
      >
        <header className="ds-memorial__header">
          <h2 className="ds-memorial__title" id="memorial-names-heading">
            Every name on this memorial
          </h2>
          <p className="ds-memorial__count">{total.toLocaleString('en-US')} names, alphabetical</p>
          {anyLinked ? (
            <p className="ds-memorial__link-note">
              Where this archive also holds a record of someone, their name is a link to it. Where
              it does not, the name is written plainly. Both are held here the same.
            </p>
          ) : null}
        </header>

        {/* Plain in-page anchors, no JS: the list is long enough that scrolling to
            a letter is the difference between finding a name and giving up, and a
            nav of links is the version that works for keyboard, screen reader and
            a page that has not hydrated alike. */}
        <nav className="ds-memorial__jump" aria-label="Jump to a letter">
          {groups.map((group) => (
            <a
              className="ds-memorial__jump-link"
              key={group.letter}
              href={`#${groupId(group.letter)}`}
            >
              {group.letter}
            </a>
          ))}
        </nav>

        {groups.map((group) => (
          <section
            className="ds-memorial__group"
            key={group.letter}
            aria-labelledby={`${groupId(group.letter)}-heading`}
          >
            <h3 className="ds-memorial__group-letter" id={`${groupId(group.letter)}-heading`}>
              <span id={groupId(group.letter)} className="ds-memorial__group-anchor" />
              {group.letter}
              <span className="ds-memorial__group-count">{group.names.length}</span>
            </h3>
            <ul className="ds-memorial__name-list">
              {group.names.map((name) => {
                const year = memorialNameYear(name);
                const entityId = entityLinksByName[name];
                return (
                  <li key={name}>
                    {entityId ? (
                      <Link className="ds-memorial__name-link" href={`/entity/${entityId}`}>
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                    {year ? <span className="ds-memorial__name-year"> · {year}</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <p className="ds-memorial__note">
          {MEMORIAL_LIST_NOTE} <Link href="/submit">Submit</Link>
          {' · '}
          <Link href="/methodology">Methodology</Link>
        </p>
      </article>
    </MemorialListContrastZone>
  );
}
