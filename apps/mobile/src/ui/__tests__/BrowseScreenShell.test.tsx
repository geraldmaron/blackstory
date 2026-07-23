/**
 * BrowseScreenShell — tab-root browse edition wrapper.
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

describe('BrowseScreenShell', () => {
  it('renders indexed header and body children', async () => {
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
