/**
 * Atlas instrument shared by `/` (the map door) and `/explore`.
 * First paint is this plate of pins, not a featured place and not a new map UI.
 * The pin feature collection is already in hand from `getSharedPublicEntities`;
 * shop tokens are stripped before it rides the first document.
 *
 * The HTML plate is the sit: discs you can click. A typed list of `/place/`
 * URLs is not the map. Only a holding `/place/` pin is a link.
 */
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { toFirstPaintPins, toFirstPaintShell } from '../lib/map-experience/first-paint-pins';
import { AtlasLoader } from './explore/AtlasLoader';
import { buildAtlasShell } from './explore/explore-view-model';
import { FirstPaintPinPlate } from './first-paint-pin-plate';
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

  return (
    <>
      <FirstPaintPinPlate pins={pins} />
      <AtlasLoader shell={firstPaintShell} pins={pins} />
    </>
  );
}
