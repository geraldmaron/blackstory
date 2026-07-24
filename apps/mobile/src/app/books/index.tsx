/**
 * Stack route for `/books` — challenged-titles catalog (web `/books` parity).
 */
import { BooksBrowseScreen } from '@/features/books';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function BooksBrowseRoute() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });
  return <BooksBrowseScreen />;
}
