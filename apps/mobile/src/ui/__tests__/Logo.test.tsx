import { render } from '@testing-library/react-native';
import { Logo, logoClearSpaceDp } from '../Logo';
import { logoConstraints } from '../tokens';

describe('Logo', () => {
  it('renders with an accessible name of "BlackStory"', async () => {
    const { getByRole } = await render(<Logo />);
    expect(getByRole('image').props.accessibilityLabel).toBe('BlackStory');
  });

  it('never renders below the guide minimum size, even if a smaller size is requested', async () => {
    const { getByRole } = await render(<Logo variant="symbol" size={10} />);
    const style = getByRole('image').props.style;
    expect(style.width).toBeGreaterThanOrEqual(logoConstraints.minSymbolSizePx);
  });

  it('logoClearSpaceDp returns the symbol height per the guide clear-space rule', async () => {
    expect(logoClearSpaceDp(120)).toBe(120);
  });
});
