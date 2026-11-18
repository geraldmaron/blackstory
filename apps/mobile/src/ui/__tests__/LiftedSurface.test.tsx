/**
 * LiftedSurface: record sheet with the web sheet shadow by default.
 */
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LiftedSurface } from '../LiftedSurface';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
  };
});

describe('LiftedSurface', () => {
  it('renders children with Surface background by default', async () => {
    const { getByText } = await render(
      <LiftedSurface>
        <Text>Panel content</Text>
      </LiftedSurface>,
    );
    expect(getByText('Panel content')).toBeTruthy();
  });

  it('carries the sheet shadow by default and none when asked', async () => {
    const sheet = await render(
      <LiftedSurface>
        <Text>Sheet</Text>
      </LiftedSurface>,
    );
    expect(JSON.stringify(sheet.toJSON())).toContain('boxShadow');

    const flush = await render(
      <LiftedSurface shadow="none">
        <Text>Flush</Text>
      </LiftedSurface>,
    );
    expect(JSON.stringify(flush.toJSON())).not.toContain('boxShadow');
  });
});
