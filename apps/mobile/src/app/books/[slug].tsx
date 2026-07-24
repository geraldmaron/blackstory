/**
 * Stack route for `/books/[slug]` — challenged title detail.
 */
import { useLocalSearchParams } from 'expo-router';
import { BooksDetailScreen, parseBookSlug } from '@/features/books';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function BooksDetailRoute() {
  useEditionStackBack({
    fallbackHref: '/books',
    accessibilityHint: 'Returns to Banned books when there is no previous screen',
  });
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const raw = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const slug = parseBookSlug(raw) ?? '';
  return <BooksDetailScreen slug={slug} />;
}
