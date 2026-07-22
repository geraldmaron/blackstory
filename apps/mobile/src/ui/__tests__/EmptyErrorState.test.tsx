import { fireEvent, render } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';

describe('EmptyState', () => {
  it('renders title/description and an optional action', async () => {
    const onPress = jest.fn();
    const { getByText, getByRole } = await render(
      <EmptyState
        title="No results"
        description="Try a different search."
        action={{ label: 'Clear filters', onPress }}
      />,
    );
    expect(getByText('No results')).toBeTruthy();
    expect(getByText('Try a different search.')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorState', () => {
  it('announces assertively and supports a retry action', async () => {
    const onRetry = jest.fn();
    const { getByText, getByRole } = await render(
      <ErrorState
        title="Could not load this page"
        description="Check your connection and try again."
        retry={{ label: 'Try again', onPress: onRetry }}
      />,
    );
    expect(getByRole('alert').props.accessibilityLiveRegion).toBe('assertive');
    expect(getByText('Could not load this page')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
