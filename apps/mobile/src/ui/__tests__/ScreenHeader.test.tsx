/**
 * ScreenHeader — edition masthead with copper kicker tick.
 */
import { render } from '@testing-library/react-native';

import { Text } from '../Text';
import { ScreenHeader } from '../ScreenHeader';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
  };
});

describe('ScreenHeader', () => {
  it('renders kicker, title, and dek', async () => {
    const { getByText } = await render(
      <ScreenHeader kicker="Find in time" title="History" dek="Search records by keyword." />,
    );

    expect(getByText('Find in time')).toBeTruthy();
    expect(getByText('History')).toBeTruthy();
    expect(getByText('Search records by keyword.')).toBeTruthy();
  });

  it('exposes header accessibility role', async () => {
    const { getByRole } = await render(<ScreenHeader title="Stories" />);
    expect(getByRole('header')).toBeTruthy();
  });

  it('renders dense titles at Ledger masthead scale with trailing actions', async () => {
    const { getByText, getByLabelText } = await render(
      <ScreenHeader
        kicker="Find in time"
        title="History"
        trailing={<Text accessibilityLabel="Developer menu">Dev</Text>}
      />,
    );

    expect(getByText('History')).toBeTruthy();
    expect(getByLabelText('Developer menu')).toBeTruthy();
  });

  it('allows sparse hero titles when dense is disabled', async () => {
    const { getByText } = await render(
      <ScreenHeader title="Archive edition" dense={false} compact={false} />,
    );
    expect(getByText('Archive edition')).toBeTruthy();
  });
});
