/**
 * Stack route for `/themes` — policy-impact themes catalog (web `/themes` parity).
 */
import { ThemesBrowseScreen } from '@/features/themes';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function ThemesBrowseRoute() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });
  return <ThemesBrowseScreen />;
}
