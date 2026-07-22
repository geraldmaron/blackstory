import { render } from '@testing-library/react-native';
import { Badge } from '../Badge';
import { confidenceColors, statusColors } from '../tokens';

describe('Badge', () => {
  it('renders the non-color cue text for a status badge (never relies on color alone)', async () => {
    const { getByText } = await render(<Badge kind="status" status="error" />);
    expect(getByText('Error')).toBeTruthy();
  });

  it('renders the non-color cue text for a confidence badge', async () => {
    const { getByText } = await render(<Badge kind="confidence" level="high" />);
    expect(getByText('High confidence')).toBeTruthy();
  });

  it('pulls its colors from the generated status tokens, not a hardcoded hex', async () => {
    const { getByText } = await render(<Badge kind="status" status="dispute" />);
    const style = getByText('Disputed').props.style;
    const flattened = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flattened.color).toBe(statusColors.light.dispute.fg);
  });

  it('pulls confidence colors from the generated tokens', async () => {
    const { getByText } = await render(<Badge kind="confidence" level="low" />);
    const style = getByText('Low confidence').props.style;
    const flattened = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flattened.color).toBe(confidenceColors.light.low.fg);
  });
});
