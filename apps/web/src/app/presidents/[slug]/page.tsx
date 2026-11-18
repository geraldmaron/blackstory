/**
 * `/presidents/[slug]`: one president's entry. The page is the shared story frame
 * (`components/story/StoryDetail.tsx`) with its entry masthead; a slug that is not a president
 * is not found here.
 */
import { StoryDetail, storyMetadata, storySlugsUnder } from '../../../components/story/StoryDetail';

type PresidentPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  return (await storySlugsUnder('/presidents')).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PresidentPageProps) {
  return storyMetadata((await params).slug);
}

export default async function PresidentPage({ params }: PresidentPageProps) {
  return <StoryDetail slug={(await params).slug} base="/presidents" />;
}
