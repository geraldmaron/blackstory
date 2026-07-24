/**
 * Smoke tests for Law detail screen.
 */
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/features/entity/linking', () => ({
  openExternalLink: jest.fn(async () => 'opened'),
}));

import { LawDetailScreen } from '../LawDetailScreen';

describe('LawDetailScreen', () => {
  it('renders explainer sections for a known slug', async () => {
    const { getByText } = await render(<LawDetailScreen slug="civil-rights-act-1964" />);
    expect(getByText('Civil Rights Act of 1964')).toBeTruthy();
    expect(getByText('What the law says')).toBeTruthy();
    expect(getByText('Not legal advice')).toBeTruthy();
  });

  it('renders missing state for unknown slug', async () => {
    const { getByText } = await render(<LawDetailScreen slug="not-a-real-law" />);
    expect(getByText('Law entry not found')).toBeTruthy();
  });
});
