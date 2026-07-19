import { render } from '@testing-library/react-native';
import { Divider } from '../Divider';

describe('Divider', () => {
  it('is hidden from assistive tech (purely decorative)', async () => {
    const { getByTestId } = await render(<Divider testID="divider" />);
    // Divider marks itself hidden from assistive tech by design, so the
    // default query (which excludes hidden elements) must opt back in here.
    const divider = getByTestId('divider', { includeHiddenElements: true });
    expect(divider.props.accessibilityElementsHidden).toBe(true);
    expect(divider.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
