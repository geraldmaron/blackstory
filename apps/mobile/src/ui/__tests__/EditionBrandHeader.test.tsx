/**
 * EditionBrandHeader — official lockup above Ledger masthead.
 */
import { render } from '@testing-library/react-native';
import { EditionBrandHeader } from '../EditionBrandHeader';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
    useThemeName: () => 'light' as const,
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: () => React.createElement(View, { testID: 'expo-image' }),
  };
});

describe('EditionBrandHeader', () => {
  it('mounts lockup + Ledger title', async () => {
    const { getByTestId, getByText, getByRole, getByLabelText } = await render(
      <EditionBrandHeader kicker="Stories" title="History pinned to place" />,
    );
    expect(getByTestId('edition-brand-header')).toBeTruthy();
    expect(getByTestId('edition-brand-lockup')).toBeTruthy();
    expect(getByLabelText('BlackStory')).toBeTruthy();
    expect(getByText('History pinned to place')).toBeTruthy();
    expect(getByRole('header')).toBeTruthy();
  });

  it('can omit brand when showBrand is false', async () => {
    const { queryByTestId, getByText } = await render(
      <EditionBrandHeader title="Themes" showBrand={false} />,
    );
    expect(queryByTestId('edition-brand-lockup')).toBeNull();
    expect(getByText('Themes')).toBeTruthy();
  });
});
