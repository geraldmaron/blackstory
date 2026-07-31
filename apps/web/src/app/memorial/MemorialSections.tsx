/**
 * Memorial edition list section. The opening screen is the wall plus the room
 * header (see page.tsx); this renders the full alphabetical list, which starts
 * below the fold and is the accessible, readable record of the same names.
 */
import Link from 'next/link';
import {
  memorialNameYear,
  memorialNamesAlphabetical,
} from '../../components/patterns/memorial-wall/memorial-names';
import { MEMORIAL_LIST_NOTE } from './memorial-copy';
import { MemorialListContrastZone } from './MemorialListContrastZone';
import { memorialEditionPanelClassName } from './memorial-panel-chrome';

export type MemorialSectionsProps = {
  /** Memorial name -> public entity id, for the small subset with a real entity page. */
  readonly entityLinksByName?: Readonly<Record<string, string>>;
};

export function MemorialSections({ entityLinksByName }: MemorialSectionsProps) {
  const names = memorialNamesAlphabetical();

  return (
    <MemorialListContrastZone>
        <article
          className={memorialEditionPanelClassName('list')}
          aria-labelledby="memorial-names-heading"
          id="memorial-names"
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
              <p className="ds-memorial-edition__count">{names.length} names · alphabetical</p>
            </div>
          </header>
          <ul className="ds-memorial-edition__name-list">
            {names.map((name) => {
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
                  {year ? <span className="ds-memorial-edition__name-year"> · {year}</span> : null}
                </li>
              );
            })}
          </ul>
          <p className="ds-memorial-edition__note">
            {MEMORIAL_LIST_NOTE}{' '}
            <Link href="/submit">Submit</Link>
            {' · '}
            <Link href="/methodology">Methodology</Link>
          </p>
        </article>
    </MemorialListContrastZone>
  );
}
