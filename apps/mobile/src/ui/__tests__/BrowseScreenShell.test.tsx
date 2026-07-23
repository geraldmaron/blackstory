/**
 * BrowseScreenShell — tab-root Ledger Line browse wrapper.
 */
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BrowseScreenShell } from '../BrowseScreenShell';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
  };
});

jest.mock('react-native-safe-area-context', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children?: unknown; style?: unknown }) =>
      React.createElement(View, { style }, children as never),
    SafeAreaProvider: ({ children }: { children?: unknown }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe('BrowseScreenShell', () => {
  it('renders masthead and body children', async () => {
    const { getByText } = await render(
      <BrowseScreenShell kicker="BlackStory" title="More" dek="Extended catalog.">
        <Text>Section body</Text>
      </BrowseScreenShell>,
    );

    expect(getByText('BlackStory')).toBeTruthy();
    expect(getByText('More')).toBeTruthy();
    expect(getByText('Extended catalog.')).toBeTruthy();
    expect(getByText('Section body')).toBeTruthy();
  });
});

