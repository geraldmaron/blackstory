/**
 * `/methodology` — supporting reference, addressed at its own canonical route.
 *
 * These pages used to live under `/learn/methodology`, which filed product reference material inside
 * the narrative surface. A reader looking for how the archive decides, or for what the app
 * collects, is not reading a Story.
 */
import { ContentPageScreen } from '@/features/content';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function MethodologyPageScreen() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });

  return <ContentPageScreen section="methodology" slug="overview" fallbackTitle="Methodology" />;
}
