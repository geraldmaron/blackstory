/**
 * `/about` — the dedicated About screen, at its own canonical route.
 *
 * It is top-level, not under `/learn`: the archive's own framing is not part of the narrative
 * surface. `AboutScreen` is the storytelling composition that matches web's `/about`, not a bare
 * content page.
 */
import { AboutScreen } from '@/features/about';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function AboutPageScreen() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });

  return <AboutScreen />;
}
