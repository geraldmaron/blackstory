/**
 * Smoke tests for Themes browse screen.
 */
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
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

import { ThemesBrowseScreen } from '../ThemesBrowseScreen';

describe('ThemesBrowseScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders method notice, pulse, and P0 theme rows', async () => {
    const { getByText, getByLabelText, getByTestId } = await render(<ThemesBrowseScreen />);
    expect(getByText('Themes')).toBeTruthy();
    expect(getByTestId('edition-brand-header')).toBeTruthy();
    expect(getByLabelText('BlackStory')).toBeTruthy();
    expect(getByText('Juxtaposition, not causation')).toBeTruthy();
    expect(getByText('Catalog pulse')).toBeTruthy();
    expect(getByLabelText('Search themes')).toBeTruthy();
    expect(getByText(/Housing segregation/i)).toBeTruthy();
  });

  it('pushes theme detail when a P0 row is pressed', async () => {
    const { getByText } = await render(<ThemesBrowseScreen />);
    fireEvent.press(getByText(/Housing segregation/i));
    expect(mockPush).toHaveBeenCalledWith('/themes/redlining');
  });
});
