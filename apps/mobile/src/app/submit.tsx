/**
 * Stack route for `/submit` — native contribute shell (corrections primary).
 */
import { SubmitScreen } from '@/features/submit';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function SubmitRoute() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });
  return <SubmitScreen />;
}
