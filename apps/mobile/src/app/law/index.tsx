/**
 * Stack route for `/law` — plain-language law catalog (web `/law` parity).
 */
import { LawBrowseScreen } from '@/features/law';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function LawBrowseRoute() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });
  return <LawBrowseScreen />;
}
