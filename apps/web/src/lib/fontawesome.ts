/**
 * Font Awesome client setup: disable auto-injected CSS so the app imports
 * `styles.css` once from KindBadge (or another top-level client entry).
 */
import { config } from '@fortawesome/fontawesome-svg-core';

config.autoAddCss = false;
