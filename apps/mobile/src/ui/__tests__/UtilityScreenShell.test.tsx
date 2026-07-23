/**
 * UtilityScreenShell — trust/discover utility edition wrapper.
 */
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { UtilityScreenShell } from '../UtilityScreenShell';

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
  };
});

describe('UtilityScreenShell', () => {
  it('wraps children in canvas + indexed header + Surface body panel', async () => {
    const { getByText } = await render(
      <UtilityScreenShell kicker="Trust" title="Corrections" dek="Report an error." index="01">
        <Text>Form body</Text>
      </UtilityScreenShell>,
    );

    expect(getByText('01', { hidden: true })).toBeTruthy();
    expect(getByText('Trust')).toBeTruthy();
    expect(getByText('Corrections')).toBeTruthy();
    expect(getByText('Report an error.')).toBeTruthy();
    expect(getByText('Form body')).toBeTruthy();
  });
});
