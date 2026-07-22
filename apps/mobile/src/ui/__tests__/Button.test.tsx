import { fireEvent, render } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('renders the label and fires onPress', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Save" onPress={onPress} />);
    const button = getByRole('button');
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('defaults the accessibilityLabel to the visible label', async () => {
    const { getByRole } = await render(<Button label="Submit correction" onPress={jest.fn()} />);
    expect(getByRole('button').props.accessibilityLabel).toBe('Submit correction');
  });

  it('marks accessibilityState.disabled and blocks onPress when disabled', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Save" onPress={onPress} disabled />);
    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('marks accessibilityState.busy and blocks onPress while loading', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Save" onPress={onPress} loading />);
    const button = getByRole('button');
    expect(button.props.accessibilityState.busy).toBe(true);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
