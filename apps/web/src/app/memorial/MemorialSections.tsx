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
import { memorialEditionPanelClassName } from './memorial-panel-chrome';

export type MemorialSectionsProps = {
  /** Memorial name -> public entity id, for the small subset with a real entity page. */
  readonly entityLinksByName?: Readonly<Record<string, string>>;
};

/** DOM id for a letter group, shared by its heading and the jump rail link. */
const groupId = (letter: string) => `memorial-names-${letter === '#' ? 'other' : letter}`;

export function MemorialSections({ entityLinksByName }: MemorialSectionsProps) {
  const groups = memorialNamesByInitial();
  const total = groups.reduce((count, group) => count + group.names.length, 0);

  return (
    <MemorialListContrastZone>
      <article
        className={memorialEditionPanelClassName('list')}
        aria-labelledby="memorial-names-heading"
        id="memorial-names"
        tabIndex={-1}
      >
        <header className="ds-memorial-edition__header">
          <span className="ds-memorial-edition__index" aria-hidden="true">
            01
          </span>
          <div>
            <p className="ds-memorial-edition__kicker">Full list</p>
            <h2 className="ds-memorial-edition__title" id="memorial-names-heading">
              Every name on this memorial
            </h2>
            <p className="ds-memorial-edition__count">{total} names · alphabetical</p>
          </div>
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
                const entityId = entityLinksByName?.[name];
                return (
                  <li key={name}>
                    {entityId ? (
                      <Link className="ds-memorial-edition__name-link" href={`/entity/${entityId}`}>
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
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
