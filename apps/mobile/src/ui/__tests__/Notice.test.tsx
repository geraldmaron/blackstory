import { render } from '@testing-library/react-native';
import { Notice } from '../Notice';

describe('Notice', () => {
  it('renders the title and description', async () => {
    const { getByText } = await render(
      <Notice tone="warning" title="Heads up" description="Something to check" />,
    );
    expect(getByText('Heads up')).toBeTruthy();
    expect(getByText('Something to check')).toBeTruthy();
  });

  it('uses an assertive live region for error/dispute (interrupts), polite otherwise', async () => {
    const error = await render(<Notice tone="error" title="Failed to load" />);
    expect(error.getByRole('alert').props.accessibilityLiveRegion).toBe('assertive');

    const info = await render(<Notice tone="info" title="Just so you know" />);
    expect(info.getByRole('alert').props.accessibilityLiveRegion).toBe('polite');
  });
});
