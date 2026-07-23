/**
 * ExpandableSection unit tests — verifies preview slicing and expand toggle.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from '@/ui';
import { ExpandableSection } from '../sections/ExpandableSection';

describe('ExpandableSection', () => {
  it('shows only the preview count until expanded', async () => {
    const items = [
      <Text key="1">One</Text>,
      <Text key="2">Two</Text>,
      <Text key="3">Three</Text>,
    ];
    const screen = await render(
      <ExpandableSection previewCount={2} items={items} itemLabel="claims" />,
    );
    expect(screen.queryByText('Three')).toBeNull();

    const button = screen.getByLabelText('Show 1 more claims');
    await act(async () => {
      fireEvent.press(button);
    });

    expect(screen.getByText('Three')).toBeTruthy();
    expect(screen.getByLabelText('Show fewer claims')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Show fewer claims'));
    });
    expect(screen.queryByText('Three')).toBeNull();
  });
});
