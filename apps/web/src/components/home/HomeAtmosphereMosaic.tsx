/**
 * Home edition gutter mosaic — thin wrapper over shared EditionAtmosphereMosaic.
 */
'use client';

import { EditionAtmosphereMosaic } from '../patterns/edition-atmosphere/EditionAtmosphereMosaic';
import { EDITION_MOSAIC_COUNT_BROWSE } from '../patterns/edition-atmosphere/edition-atmosphere-config';

const HOME_MOSAIC_SEED = 'home-edition-v6';

export function HomeAtmosphereMosaic() {
  return <EditionAtmosphereMosaic seedKey={HOME_MOSAIC_SEED} count={EDITION_MOSAIC_COUNT_BROWSE} />;
}
