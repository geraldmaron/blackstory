/**
 * Smoke tests for Themes detail screen.
 */
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: () => React.createElement(View, { testID: 'expo-image' }),
  };
});

import { ThemesDetailScreen } from '../ThemesDetailScreen';

describe('ThemesDetailScreen', () => {
  it('renders redlining packets with method stance', async () => {
    const { getByText, getAllByText, getByTestId, getByLabelText } = await render(
      <ThemesDetailScreen themeId="redlining" />,
    );
    expect(getByText(/Housing segregation/i)).toBeTruthy();
    expect(getByTestId('edition-brand-header')).toBeTruthy();
    expect(getByLabelText('BlackStory')).toBeTruthy();
    expect(getAllByText(/Juxtaposition, not causation/i).length).toBeGreaterThan(0);
    expect(getAllByText('Packet').length).toBeGreaterThan(0);
  });

  it('shows empty state for unknown theme ids', async () => {
    const { getByText } = await render(<ThemesDetailScreen themeId="not_a_theme" />);
    expect(getByText('Theme not found')).toBeTruthy();
  });
});
