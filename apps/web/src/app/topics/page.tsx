/**
 * Topics index for thematic browsing — one of the three honest paths to every
 * record (map, search, browse). Entries share the story-link anatomy (v5
 * pattern law) rather than boxed cards.
 */

import Link from 'next/link';
import { SeedDataNotice } from '../../components/SeedDataNotice';

export const metadata = {
  title: 'Topics',
  description: 'Thematic entry points into the Blap archive.',
};

const TOPICS = [
  {
    id: 'education',
    title: 'Education & schools',
    body: 'Freedmen schools, campuses, and place-connected educational institutions.',
  },
  {
    id: 'community',
    title: 'Community places',
    body: 'Neighborhoods, halls, and gathering sites documented in the historical record.',
  },
  {
    id: 'reconstruction',
    title: 'Reconstruction era',
    body: 'Records whose primary documented activity falls in Reconstruction-era windows.',
  },
] as const;

export default function TopicsPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Browse</p>
      <h1 className="ds-page__title">Topics</h1>
      <p className="ds-page__lede">
        Thematic paths into the archive — pick a thread and follow it across states and decades.
      </p>

      <section className="ds-section ds-section--flush" aria-label="Topic list">
        <SeedDataNotice compact />
        <ul className="ds-story-rail">
          {TOPICS.map((topic) => (
            <li key={topic.id}>
              <Link className="ds-story-link" href={`/search?topic=${topic.id}`}>
                <span className="ds-story-link__meta">Topic</span>
                <h2 className="ds-story-link__title">{topic.title}</h2>
                <p className="ds-story-link__summary">{topic.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
