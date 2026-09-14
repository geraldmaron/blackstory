/**
 * `/support` — supporting reference, addressed at its own canonical route.
 *
 * Previously a web-only page: the row existed in native More, but had no native screen and
 * opened Safari instead. Support is a task surface (find the right path, get a contact address),
 * not a narrative one, so it renders through `ContentPageScreen`'s flat "document" presentation —
 * the same non-immersive, no-animation shell every other reference page (About, Methodology,
 * Errata, Privacy, Terms) already uses. `UtilityScreenShell` is reserved for screens with an
 * actual input surface (corrections submit/status); this page has no form fields, so it is not
 * the right shell here.
 */
import { ContentPageScreen } from '@/features/content';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function SupportPageScreen() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });

  return <ContentPageScreen section="support" slug="support" fallbackTitle="Support" />;
}
