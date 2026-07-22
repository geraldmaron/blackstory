import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ListRow } from '../ListRow';

describe('ListRow', () => {
  it('is pressable and reports accessibilityRole="button" when interactive', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<ListRow title="Harriet Tubman" onPress={onPress} />);
    const row = getByRole('button');
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('combines title and subtitle into the accessible label', async () => {
    const { getByRole } = await render(
      <ListRow title="Harriet Tubman" subtitle="Auburn, NY" onPress={jest.fn()} />,
    );
    expect(getByRole('button').props.accessibilityLabel).toBe('Harriet Tubman, Auburn, NY');
  });

  it('renders as a static, non-button row when interactive=false', async () => {
    const { queryByRole, getByText } = await render(
      <ListRow title="Info row" interactive={false} showDivider={false} />,
    );
    expect(queryByRole('button')).toBeNull();
    expect(getByText('Info row')).toBeTruthy();
  });

  it('renders leading/trailing content', async () => {
    const { getByText } = await render(
      <ListRow
        title="Row with extras"
        leading={<Text>L</Text>}
        trailing={<Text>T</Text>}
        interactive={false}
      />,
    );
    expect(getByText('L')).toBeTruthy();
    expect(getByText('T')).toBeTruthy();
  });
});
