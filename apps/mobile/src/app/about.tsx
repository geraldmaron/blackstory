/**
 * `/about` — the dedicated About screen, at its own canonical route.
 *
 * It used to be `/learn/about`, which filed the archive's own framing inside the narrative
 * surface. The screen itself is unchanged: `AboutScreen` is the storytelling composition that
 * matches web's `/about`, not a bare content page.
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
