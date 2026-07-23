/**
 * Memorial edition Surface sections: intro thesis and the full alphabetical name list.
 */
import Link from 'next/link';
import { memorialNamesAlphabetical } from '../../components/patterns/memorial-wall/memorial-names';
import {
  MEMORIAL_INTRO_PARAGRAPHS,
  MEMORIAL_KICKER,
  MEMORIAL_LEDE,
  MEMORIAL_LIST_NOTE,
  MEMORIAL_PAGE_TITLE,
} from './memorial-copy';
import { memorialEditionPanelClassName } from './memorial-panel-chrome';

export function MemorialSections() {
  const names = memorialNamesAlphabetical();

  return (
    <>
      <article className={memorialEditionPanelClassName('intro')}>
        <header className="ds-memorial-edition__header">
          <span className="ds-memorial-edition__index" aria-hidden="true">
            00
          </span>
          <div>
            <p className="ds-memorial-edition__kicker">{MEMORIAL_KICKER}</p>
            <h1 className="ds-memorial-edition__title">
              {MEMORIAL_PAGE_TITLE}. Names held in <em>remembrance</em>.
            </h1>
            <p className="ds-memorial-edition__lede">{MEMORIAL_LEDE}</p>
            <p className="ds-memorial-edition__actions">
              <Link className="ds-cta ds-cta--solid" href="#memorial-names">
                Read the full list
              </Link>
              <Link className="ds-cta ds-cta--quiet" href="/explore">
                Open the map
              </Link>
            </p>
          </div>
        </header>
        <div className="ds-memorial-edition__body">
          {MEMORIAL_INTRO_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
      </article>

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
          {names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="ds-memorial-edition__note">
          {MEMORIAL_LIST_NOTE}{' '}
          <Link href="/submit">Submit</Link>
          {' · '}
          <Link href="/methodology">Methodology</Link>
        </p>
      </article>
    </>
  );
}
