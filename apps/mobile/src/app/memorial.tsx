/**
 * Stack route for `/memorial` — names-forward remembrance list (web `/memorial` parity).
 */
import { MemorialScreen } from '@/features/memorial';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function MemorialRoute() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });
  return <MemorialScreen />;
}
