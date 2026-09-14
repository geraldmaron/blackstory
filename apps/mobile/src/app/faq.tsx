/**
 * `/faq` — supporting reference, addressed at its own canonical route.
 *
 * Previously a web-only page: the row existed in native More, but had no native screen and
 * opened Safari instead. A reader looking for plain answers about how the archive works should
 * not have to leave the app to find them.
 */
import { ContentPageScreen } from '@/features/content';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function FaqPageScreen() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });

  return <ContentPageScreen section="faq" slug="faq" fallbackTitle="Questions" />;
}
