import { render } from '@testing-library/react-native';
import { Text } from '../Text';
import { themeColors } from '../tokens';

describe('Text', () => {
  it('renders its children', async () => {
    const { getByText } = await render(<Text>Hello BlackStory</Text>);
    expect(getByText('Hello BlackStory')).toBeTruthy();
  });

  it('exposes a "header" accessibilityRole for heading variants (display/title/subtitle)', async () => {
    const { getByRole } = await render(<Text variant="title">A Title</Text>);
    expect(getByRole('header')).toBeTruthy();
  });

  it('does not set a heading role for body text', async () => {
    const { queryByRole } = await render(<Text variant="body">Body copy</Text>);
    expect(queryByRole('header')).toBeNull();
  });

  it('never disables Dynamic Type (allowFontScaling stays true)', async () => {
    const { getByText } = await render(<Text>Scales with the system</Text>);
    expect(getByText('Scales with the system').props.allowFontScaling).not.toBe(false);
  });

  it('colors come from the generated theme tokens, not a hardcoded hex', async () => {
    const { getByText } = await render(<Text colorRole="accent">Accent text</Text>);
    const style = getByText('Accent text').props.style;
    const flattened = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flattened.color).toBe(themeColors.light.accent);
  });
});
