import { act, render } from '@testing-library/react-native';
import { Text } from '../Text';
import { themeColors, typeScale } from '../tokens';
import { resetTestWindowSize, setTestWindowSize } from '../layout/testing';

function styleOf(node: { props: { style: unknown } }): Record<string, number> {
  const style = node.props.style;
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

describe('Text — Dynamic Type keeps the line box around the letters', () => {
  afterEach(resetTestWindowSize);

  it('scales lineHeight by the same multiplier the OS applies to fontSize', async () => {
    setTestWindowSize({ width: 402, height: 874, fontScale: 3.1 });
    const { getByText } = await render(<Text variant="body">Body copy</Text>);

    // React Native grows `fontSize` on its own and leaves a numeric `lineHeight` alone, so a
    // 16pt body at the largest accessibility size renders ~50pt tall inside a 24pt line box and
    // is cropped to the tops of its own letters. The ratio is what has to survive.
    expect(styleOf(getByText('Body copy')).lineHeight).toBeCloseTo(
      typeScale.body.lineHeight * 3.1,
      5,
    );
  });

  it('leaves the ratio alone at the default text size', async () => {
    setTestWindowSize({ width: 402, height: 874, fontScale: 1 });
    const { getByText } = await render(<Text variant="body">Body copy</Text>);
    expect(styleOf(getByText('Body copy')).lineHeight).toBe(typeScale.body.lineHeight);
  });

  it('honors maxFontSizeMultiplier, so a capped size gets a capped line box', async () => {
    setTestWindowSize({ width: 402, height: 874, fontScale: 3.1 });
    const { getByText } = await render(
      <Text variant="body" maxFontSizeMultiplier={1.4}>
        Capped copy
      </Text>,
    );
    // Without this the line box would keep growing past text that had stopped, opening a gap
    // the caller capped the size specifically to avoid.
    expect(styleOf(getByText('Capped copy')).lineHeight).toBeCloseTo(
      typeScale.body.lineHeight * 1.4,
      5,
    );
  });

  it('follows a text-size change made while the screen is already mounted', async () => {
    setTestWindowSize({ width: 402, height: 874, fontScale: 1 });
    const { getByText } = await render(<Text variant="body">Body copy</Text>);
    expect(styleOf(getByText('Body copy')).lineHeight).toBe(typeScale.body.lineHeight);

    await act(async () => setTestWindowSize({ width: 402, height: 874, fontScale: 2 }));

    // A one-shot PixelRatio read would leave every mounted screen with the old line boxes
    // until it remounted.
    expect(styleOf(getByText('Body copy')).lineHeight).toBeCloseTo(
      typeScale.body.lineHeight * 2,
      5,
    );
  });
});
