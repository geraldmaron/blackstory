/**
 * Memorial edition Surface sections: "Held in the Wall" reads as blank-except-names
 * at first. The intro thesis is kept for accessibility/SEO but visually hidden;
 * the full alphabetical list stays the accessible record, reached via a single
 * small quiet text link (not a card/button) rather than an up-front panel.
 */
import Link from 'next/link';
import {
  memorialNameYear,
  memorialNamesAlphabetical,
} from '../../components/patterns/memorial-wall/memorial-names';
import {
  MEMORIAL_INTRO_PARAGRAPHS,
  MEMORIAL_KICKER,
  MEMORIAL_LEDE,
  MEMORIAL_LIST_NOTE,
  MEMORIAL_PAGE_TITLE,
  MEMORIAL_QUIET_LIST_LINK_LABEL,
} from './memorial-copy';
import { MemorialListContrastZone } from './MemorialListContrastZone';
import { MemorialQuietListLink } from './MemorialQuietListLink';
import { memorialEditionPanelClassName } from './memorial-panel-chrome';

export type MemorialSectionsProps = {
  /** Memorial name -> public entity id, for the small subset with a real entity page. */
  readonly entityLinksByName?: Readonly<Record<string, string>>;
};

export function MemorialSections({ entityLinksByName }: MemorialSectionsProps) {
  const names = memorialNamesAlphabetical();

  return (
    <>
      {/* Visually hidden: keeps an accessible title/lede/kicker for screen
          readers and SEO without showing a header/CTA panel on load. */}
      <div className="ds-memorial-edition__sr-intro">
        <p>{MEMORIAL_KICKER}</p>
        <h1>{MEMORIAL_PAGE_TITLE}. Names held in remembrance.</h1>
        <p>{MEMORIAL_LEDE}</p>
        {MEMORIAL_INTRO_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </div>

      <MemorialQuietListLink label={MEMORIAL_QUIET_LIST_LINK_LABEL} />

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
    </>
  );
}
