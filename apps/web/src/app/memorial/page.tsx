/**
 * Memorial v6 edition: full-canvas handwritten name wall with an opaque Surface
 * stack carrying the readable alphabetical list. No photo mosaic.
 */

import { MemorialWallAtmosphere } from '../../components/patterns/memorial-wall/MemorialWallAtmosphere';
import { MemorialSections } from './MemorialSections';
import {
  MEMORIAL_PAGE_DESCRIPTION,
  MEMORIAL_PAGE_TITLE,
} from './memorial-copy';
import {
  MEMORIAL_EDITION_WALL_SEED,
  memorialEditionRootClassName,
  memorialEditionStackClassName,
} from './memorial-panel-chrome';
import './memorial-edition.css';

export const metadata = {
  title: MEMORIAL_PAGE_TITLE,
  description: MEMORIAL_PAGE_DESCRIPTION,
};

export default function MemorialPage() {
  return (
    <div className={memorialEditionRootClassName()} data-memorial-edition="v6">
      <MemorialWallAtmosphere seedKey={MEMORIAL_EDITION_WALL_SEED} />
      <main className="ds-container ds-page" id="main">
        <div className={memorialEditionStackClassName()}>
          <MemorialSections />
        </div>
      </main>
    </div>
  );
}
