/**
 * Memorial edition list section. The opening screen is the wall plus the room
 * header (see page.tsx); this renders the full alphabetical list, which starts
 * below the fold and is the accessible, readable record of the same names.
 */
import Link from 'next/link';
import {
  memorialNameYear,
  memorialNamesByInitial,
} from '../../components/patterns/memorial-wall/memorial-names';
import { MEMORIAL_LIST_NOTE } from './memorial-copy';
import { MemorialListContrastZone } from './MemorialListContrastZone';

export type MemorialSectionsProps = {
  /** Kept for the wall atmosphere. The name list itself stays names. */
  readonly entityLinksByName?: Readonly<Record<string, string>>;
};

/** DOM id for a letter group, shared by its heading and the jump rail link. */
const groupId = (letter: string) => `memorial-names-${letter === '#' ? 'other' : letter}`;

export function MemorialSections(_props: MemorialSectionsProps = {}) {
  const groups = memorialNamesByInitial();
  const total = groups.reduce((count, group) => count + group.names.length, 0);

  return (
    <MemorialListContrastZone>
      {/*
        No panel, no numeral, no kicker. This list is not section 01 of a publication and it is
        not a card: it is the names, and every frame drawn around them was chrome asserting
        itself over them. What is left is a heading, a count, and the list.
      */}
      <article
        className="ds-memorial-edition__list"
        aria-labelledby="memorial-names-heading"
        id="memorial-names"
        tabIndex={-1}
      >
        <header className="ds-memorial-edition__header">
          <h2 className="ds-memorial-edition__title" id="memorial-names-heading">
            Every name on this memorial
          </h2>
          <p className="ds-memorial-edition__count">
            {total.toLocaleString('en-US')} names, alphabetical
          </p>
        </header>

        {/* Plain in-page anchors, no JS: the list is long enough that scrolling to
            a letter is the difference between finding a name and giving up, and a
            nav of links is the version that works for keyboard, screen reader and
            a page that has not hydrated alike. */}
        <nav className="ds-memorial-edition__jump" aria-label="Jump to a letter">
          {groups.map((group) => (
            <a
              className="ds-memorial-edition__jump-link"
              key={group.letter}
              href={`#${groupId(group.letter)}`}
            >
              {group.letter}
            </a>
          ))}
        </nav>

        {groups.map((group) => (
          <section
            className="ds-memorial-edition__group"
            key={group.letter}
            aria-labelledby={`${groupId(group.letter)}-heading`}
          >
            <h3
              className="ds-memorial-edition__group-letter"
              id={`${groupId(group.letter)}-heading`}
            >
              <span id={groupId(group.letter)} className="ds-memorial-edition__group-anchor" />
              {group.letter}
              <span className="ds-memorial-edition__group-count">{group.names.length}</span>
            </h3>
            <ul className="ds-memorial-edition__name-list">
              {group.names.map((name) => {
                const year = memorialNameYear(name);
                return (
                  <li key={name}>
                    {name}
                    {year ? (
                      <span className="ds-memorial-edition__name-year"> · {year}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <p className="ds-memorial-edition__note">
          {MEMORIAL_LIST_NOTE} <Link href="/submit">Submit</Link>
          {' · '}
          <Link href="/methodology">Methodology</Link>
        </p>
      </article>
    </MemorialListContrastZone>
  );
}
