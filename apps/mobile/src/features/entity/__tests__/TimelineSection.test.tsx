/**
 * The chronology must not print the archive's claim ids at the reader.
 */
import { render } from '@testing-library/react-native';

import { TimelineSection } from '../sections/TimelineSection';
import type { TimelineEvent } from '../types';

const shipped: TimelineEvent = {
  id: 'tl_1',
  atLabel: '1840',
  datePrecision: 'year',
  title: 'Status: Active',
  body:
    'In effect from 1840, ongoing as of this release. Basis: ' +
    'plantation_arlington_antebellum_home_gardens_q4792278_claim_0, ' +
    'plantation_arlington_antebellum_home_gardens_q4792278_claim_1.',
};

describe('TimelineSection', () => {
  it('keeps the dated sentence and drops the Basis tail of claim ids', async () => {
    const { getByText, queryByText } = await render(
      <TimelineSection timeline={[shipped]} index="06" />,
    );
    expect(getByText('In effect from 1840.')).toBeTruthy();
    expect(queryByText(/Basis:/)).toBeNull();
    expect(queryByText(/claim_0/)).toBeNull();
  });

  it('renders nothing at all when there is no dated span', async () => {
    const { toJSON } = await render(<TimelineSection timeline={[]} index="06" />);
    expect(toJSON()).toBeNull();
  });
});
