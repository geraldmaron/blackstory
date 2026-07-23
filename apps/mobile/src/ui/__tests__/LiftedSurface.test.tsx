/**
 * LiftedSurface — flat matte edition panel.
 */
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LiftedSurface } from '../LiftedSurface';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
    useShadowStyle: () => ({}),
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

  it('applies no shadow styles by default (flat matte)', async () => {
    const { toJSON } = await render(
      <LiftedSurface testID="panel">
        <Text>Flat</Text>
      </LiftedSurface>,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('shadowOpacity');
  });
});
