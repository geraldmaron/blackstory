import { render } from '@testing-library/react-native';
import { Text } from '../Text';
import { themeColors, typeScale } from '../tokens';
import { resetTestWindowSize, setTestWindowSize } from '../layout/testing';

// Takes any props bag: RNTL's TestInstance does not declare `style`, so requiring it in the
// parameter type failed the mobile typecheck even though every Text node carries one at runtime.
function styleOf(node: { props: object }): Record<string, number> {
  const style = (node.props as { style?: unknown }).style;
  return Array.isArray(style)
    ? Object.assign({}, ...style.flat().filter(Boolean))
    : ((style ?? {}) as Record<string, number>);
}

describe('Text', () => {
  it('renders its children', async () => {
    const { getByText } = await render(<Text>Hello BlackStory</Text>);
    expect(getByText('Hello BlackStory')).toBeTruthy();
  });

  it('exposes a "header" accessibilityRole for heading variants (display/title/subtitle)', async () => {
    const { getByRole } = await render(<Text variant="headline">A Title</Text>);
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

describe('Text: Dynamic Type', () => {
  afterEach(resetTestWindowSize);

  it('writes lineHeight unscaled, because React Native scales it with the font', async () => {
    // Scaling it here as well squared the multiplier: about 7.9x at the largest size.
    setTestWindowSize({ width: 402, height: 874, fontScale: 3.1 });
    const { getByText } = await render(<Text variant="body">Body copy</Text>);
    expect(styleOf(getByText('Body copy')).lineHeight).toBe(typeScale.body.lineHeight);
  });

  it('never turns font scaling off, and passes a cap through', async () => {
    const { getByText } = await render(
      <Text variant="body" maxFontSizeMultiplier={1.4}>
        Capped copy
      </Text>,
    );
    expect(getByText('Capped copy').props.allowFontScaling).toBe(true);
    expect(getByText('Capped copy').props.maxFontSizeMultiplier).toBe(1.4);
  });
});
