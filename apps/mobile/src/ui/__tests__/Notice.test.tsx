import { render } from '@testing-library/react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import { Notice } from '../Notice';
import { space } from '../tokens';

function flattenStyle(style: ViewStyle | TextStyle | undefined): Array<ViewStyle | TextStyle> {
  if (!style) return [];
  const items = Array.isArray(style) ? style : [style];
  return items.flatMap((item) =>
    item && typeof item === 'object' && !Array.isArray(item) ? [item] : flattenStyle(item as ViewStyle),
  );
}

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

  it('applies compact spacing and readable description type', async () => {
    const { getByRole, getByText } = await render(
      <Notice compact tone="warning" title="Live data unavailable" description="Start api-public" />,
    );

    const banner = getByRole('alert');
    expect(banner.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paddingHorizontal: space['3'],
          paddingVertical: space['3'],
        }),
      ]),
    );

    const description = getByText('Start api-public');
    expect(flattenStyle(description.props.style)).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: space['2'] })]),
    );
  });
});
