/**
 * Stack route for `/presidents`: the collection list (web `/presidents` parity).
 */
import { PresidentsScreen } from '@/features/stories';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function PresidentsRoute() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });
  return <PresidentsScreen />;
}
