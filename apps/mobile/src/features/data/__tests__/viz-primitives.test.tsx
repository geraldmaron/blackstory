/**
 * Unit tests for Data visualization helpers (proportion math + coverage labels).
 */
import { render } from '@testing-library/react-native';
import { CoveragePulse } from '../CoveragePulse';
import { MethodCallout } from '../MethodCallout';
import { ProportionBar } from '../ProportionBar';
import { SparklineStrip } from '../SparklineStrip';
import { DATA_INDICATOR_FIXTURE_BUNDLE } from '../indicator-snapshot';

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

describe('ProportionBar', () => {
  it('renders labels and formatted values for a race pair', async () => {
    const { getByText } = await render(
      <ProportionBar
        rows={[
          { label: 'Black families', value: 44_900, unit: 'usd', accent: true },
          { label: 'White non-Hispanic families', value: 285_000, unit: 'usd' },
        ]}
      />,
    );
    expect(getByText('Black families')).toBeTruthy();
    expect(getByText('$44,900')).toBeTruthy();
    expect(getByText('$285,000')).toBeTruthy();
  });

  it('returns null when max value is zero', async () => {
    const { queryByText } = await render(
      <ProportionBar rows={[{ label: 'Empty', value: 0, unit: 'percent' }]} />,
    );
    expect(queryByText('Empty')).toBeNull();
  });
});

describe('SparklineStrip', () => {
  it('renders period labels for homeownership fixture', async () => {
    const { getByText } = await render(
      <SparklineStrip series={DATA_INDICATOR_FIXTURE_BUNDLE.cookHomeownership} />,
    );
    expect(getByText('1990')).toBeTruthy();
    expect(getByText('2010')).toBeTruthy();
    expect(getByText('Black householder')).toBeTruthy();
  });
});

describe('CoveragePulse', () => {
  it('labels deferred and fixture statuses', async () => {
    const { getByText } = await render(
      <CoveragePulse
        items={[
          { id: 'population', label: 'Population', status: 'deferred' },
          { id: 'wealth', label: 'Wealth', status: 'fixture' },
        ]}
      />,
    );
    expect(getByText('Population')).toBeTruthy();
    expect(getByText('Deferred')).toBeTruthy();
    expect(getByText('Fixture')).toBeTruthy();
  });
});

describe('MethodCallout', () => {
  it('renders modeling label and body', async () => {
    const { getByText } = await render(
      <MethodCallout label="Juxtaposition" body="Comparison is not causation." />,
    );
    expect(getByText('Juxtaposition')).toBeTruthy();
    expect(getByText('Comparison is not causation.')).toBeTruthy();
  });
});
