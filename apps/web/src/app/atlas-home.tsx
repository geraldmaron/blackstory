/**
 * Atlas instrument shared by `/` (the map door) and `/explore`.
 * First paint is this plate of pins, not a featured place and not a new map UI.
 * The pin feature collection is already in hand from `getSharedPublicEntities`;
 * shop tokens are stripped before it rides the first document.
 */
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import {
  firstPaintWalksFirst,
  toFirstPaintPins,
  toFirstPaintShell,
} from '../lib/map-experience/first-paint-pins';
import { isHoldingPlaceHref } from '../lib/place/public-place-path';
import { AtlasLoader } from './explore/AtlasLoader';
import { buildAtlasShell } from './explore/explore-view-model';
import '../components/patterns/browse-mode.css';
import '../components/patterns/edition-fact-icon.css';
import './explore/explore.css';
import './explore/explore-edition.css';

type AtlasHomeProps = {
  readonly params: Record<string, string | string[] | undefined>;
  /** Kept so `/` and `/explore` callers compile. First paint no longer posts a filter form. */
  readonly formAction?: '/' | '/explore';
};

export async function AtlasHome({ params }: AtlasHomeProps) {
  const { data: entities, source: dataSource } = await getSharedPublicEntities();
  const { shell, noscriptFeatures } = buildAtlasShell(params, entities, dataSource);
  const pins = toFirstPaintPins(noscriptFeatures);
  const firstPaintShell = toFirstPaintShell(shell);
  const walks = firstPaintWalksFirst(pins).filter((feature) =>
    isHoldingPlaceHref(feature.properties.href),
  );

  return (
    <>
      <noscript>
        <div className="ds-explore__noscript ds-container ds-page">
          {walks.length > 0 ? (
            <ul className="ds-explore__walks">
              {walks.map((feature) => (
                <li key={feature.properties.href}>
                  <a href={feature.properties.href}>{feature.properties.displayName}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </noscript>

      <AtlasLoader shell={firstPaintShell} pins={pins} />
    </>
  );
}
