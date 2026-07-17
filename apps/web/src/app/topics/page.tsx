/**
 * Topics index for thematic browsing of sample records.
 */

import { Card } from '@black-book/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';

export const metadata = {
  title: 'Topics',
  description: 'Thematic entry points into Black Book sample records.',
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
    <main className="bb-container bb-page" id="main">
      <p className="bb-page__eyebrow">Browse</p>
      <h1 className="bb-page__title">Topics</h1>
      <p className="bb-page__lede">
        Thematic paths into the catalog. Filters currently resolve against seed fixtures only.
      </p>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <SeedDataNotice compact />
        <div className="bb-feature-grid">
          {TOPICS.map((topic) => (
            <Card key={topic.id} title={topic.title} interactive>
              <p className="bb-sans" style={{ marginTop: 0 }}>
                {topic.body}
              </p>
              <a className="bb-cta-link" href={`/search?topic=${topic.id}`}>
                View sample records
              </a>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
