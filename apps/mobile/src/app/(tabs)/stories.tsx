/**
 * Stories tab — the narrative publication surface, at its own canonical route.
 *
 * The route was `/learn` and the feature was `features/learn`, which is an editorial-CMS word
 * for a reader-facing product axis. The tab already said "Stories"; the address it pushed did
 * not, so every deep link, restoration root and back-fallback in the app named a surface the
 * product no longer had.
 */
import { StoriesHomeScreen } from '@/features/stories';

export default function StoriesTabScreen() {
  return <StoriesHomeScreen />;
}
