/**
 * `/stories/[slug]`: one story. The page itself is `components/story/StoryDetail.tsx`, shared with
 * the collection routes; a collection entry requested here 308s to its own address.
 */
import { StoryDetail, storyMetadata, storySlugsUnder } from '../../../components/story/StoryDetail';

type StoryPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  return (await storySlugsUnder('/stories')).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: StoryPageProps) {
  return storyMetadata((await params).slug);
}

export default async function StoryPage({ params }: StoryPageProps) {
  return <StoryDetail slug={(await params).slug} base="/stories" />;
}
