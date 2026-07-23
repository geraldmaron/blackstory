/**
 * CorrectionTextField — shared form text input primitive.
 */
import { render } from '@testing-library/react-native';

import { CorrectionTextField } from '../CorrectionTextField';

jest.mock('../tokens', () => {
  const actual = jest.requireActual('../tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
    useStatusColors: () => actual.statusColors.light,
  };
});

describe('CorrectionTextField', () => {
  it('renders with the shared 44pt minimum touch target', async () => {
    const { getByLabelText } = await render(
      <CorrectionTextField accessibilityLabel="Record identifier" />,
    );
    const input = getByLabelText('Record identifier');
    const flatStyle = Array.isArray(input.props.style)
      ? Object.assign({}, ...input.props.style.filter(Boolean))
      : input.props.style;
    expect(flatStyle.minHeight).toBeGreaterThanOrEqual(44);
  });
});
