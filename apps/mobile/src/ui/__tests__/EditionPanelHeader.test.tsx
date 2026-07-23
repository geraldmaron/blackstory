/**
 * EditionPanelHeader tests: index, kicker, title, dek rendering.
 */
import { render } from '@testing-library/react-native';
import { EditionPanelHeader } from '../EditionPanelHeader';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
  };
});

describe('EditionPanelHeader', () => {
  it('renders index, kicker, title, and dek', async () => {
    const { getByText } = await render(
      <EditionPanelHeader
        index="01"
        kicker="Archive"
        title="Published stories"
        dek="Each entry links to records and sources."
      />,
    );
    expect(getByText('01', { hidden: true })).toBeTruthy();
    expect(getByText('Archive')).toBeTruthy();
    expect(getByText('Published stories')).toBeTruthy();
    expect(getByText(/Each entry links to records/)).toBeTruthy();
  });
});
