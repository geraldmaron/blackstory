/**
 * Stack route for `/law/[slug]` — law entry detail.
 */
import { useLocalSearchParams } from 'expo-router';
import { LawDetailScreen, parseLawSlug } from '@/features/law';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function LawDetailRoute() {
  useEditionStackBack({
    fallbackHref: '/law',
    accessibilityHint: 'Returns to Law when there is no previous screen',
  });
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const raw = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const slug = parseLawSlug(raw) ?? '';
  return <LawDetailScreen slug={slug} />;
}
