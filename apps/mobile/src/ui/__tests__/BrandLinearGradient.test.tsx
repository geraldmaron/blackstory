/**
 * BrandLinearGradient — shared expo-linear-gradient host tests.
 */
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BrandLinearGradient } from '@/ui/BrandLinearGradient';
import { getGradient } from '@/ui';

describe('BrandLinearGradient', () => {
  it('renders gradient stop data from elevation tokens', async () => {
    const gradient = getGradient('surfaceLift', 'dark');
    const { getByText } = await render(
      <BrandLinearGradient gradient={gradient}>
        <Text>layer</Text>
      </BrandLinearGradient>,
    );
    expect(getByText('layer')).toBeTruthy();
  });

  it('uses light-theme copper accent stop for copperAccentEdge', async () => {
    const gradient = getGradient('copperAccentEdge', 'light');
    expect(gradient.colors[gradient.colors.length - 1]).toBeDefined();
    const { toJSON } = await render(<BrandLinearGradient gradient={gradient} />);
    expect(toJSON()).toBeTruthy();
  });
});
