/**
 * UtilityScreenShell — trust/discover utility edition wrapper.
 */
import { createRef } from 'react';
import { render } from '@testing-library/react-native';
import { ScrollView, Text } from 'react-native';

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
  it('wraps children in canvas + masthead + Surface body panel', async () => {
    const { getByText, queryByText } = await render(
      <UtilityScreenShell kicker="Trust" title="Corrections" dek="Report an error.">
        <Text>Form body</Text>
      </UtilityScreenShell>,
    );

    expect(queryByText('01')).toBeNull();
    expect(getByText('Trust')).toBeTruthy();
    expect(getByText('Corrections')).toBeTruthy();
    expect(getByText('Report an error.')).toBeTruthy();
    expect(getByText('Form body')).toBeTruthy();
  });

  it('forwards scrollProps and a ScrollView ref to the underlying scroller', async () => {
    const scrollRef = createRef<ScrollView>();
    const { getByTestId } = await render(
      <UtilityScreenShell
        ref={scrollRef}
        kicker="Trust"
        title="Corrections"
        scrollProps={{ keyboardShouldPersistTaps: 'handled', keyboardDismissMode: 'on-drag' }}
      >
        <Text>Form body</Text>
      </UtilityScreenShell>,
    );

    const scrollView = getByTestId('utility-screen-shell-scroll');
    expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scrollView.props.keyboardDismissMode).toBe('on-drag');
    expect(scrollRef.current).not.toBeNull();
  });
});
