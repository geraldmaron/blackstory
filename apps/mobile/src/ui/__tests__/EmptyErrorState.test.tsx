import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';

type HostNode = { props: Record<string, unknown>; children: readonly unknown[] };

/** Host elements matching a prop predicate — these primitives expose no testIDs. */
function hostElementsWhere(
  view: RenderResult,
  predicate: (props: Record<string, unknown>) => boolean,
): HostNode[] {
  const matches: HostNode[] = [];
  const visit = (node: unknown) => {
    if (typeof node !== 'object' || node === null || !('props' in node)) return;
    const host = node as HostNode;
    if (predicate(host.props)) matches.push(host);
    for (const child of host.children ?? []) visit(child);
  };
  visit(view.root);
  return matches;
}

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

  it('drops the decorative glyph in compact density but keeps title and action', async () => {
    const onPress = jest.fn();
    const full = await render(<EmptyState title="No results" />);
    const compact = await render(<EmptyState title="No results" compact />);

    // The glyph is the only element hidden from assistive tech in this primitive.
    const isGlyph = (props: Record<string, unknown>) =>
      props.accessibilityElementsHidden === true;
    expect(hostElementsWhere(full, isGlyph)).toHaveLength(1);
    expect(hostElementsWhere(compact, isGlyph)).toHaveLength(0);

    const withAction = await render(
      <EmptyState title="No results" compact action={{ label: 'Clear filters', onPress }} />,
    );
    fireEvent.press(withAction.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorState', () => {
  it('announces assertively and supports a retry action', async () => {
    const onRetry = jest.fn();
    const view = await render(
      <ErrorState
        title="Could not load this page"
        description="Check your connection and try again."
        retry={{ label: 'Try again', onPress: onRetry }}
      />,
    );
    // The container carries the live region but is deliberately NOT an accessibility
    // element itself — `accessible` would collapse the subtree and hide the retry
    // button from VoiceOver, so it is queried by props rather than by role.
    const { getByText, getByRole } = view;
    const [container] = hostElementsWhere(
      view,
      (props) => props.accessibilityLiveRegion === 'assertive',
    );
    expect(container.props.accessibilityRole).toBe('alert');
    expect(container.props.accessible).toBeUndefined();
    expect(getByText('Could not load this page')).toBeTruthy();
    // Regression guard: the retry action must stay reachable as its own a11y element.
    fireEvent.press(getByRole('button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('drops the decorative glyph in compact density but keeps the retry action', async () => {
    const onRetry = jest.fn();
    const full = await render(<ErrorState title="Offline" />);
    const compact = await render(<ErrorState title="Offline" compact />);

    const isGlyph = (props: Record<string, unknown>) =>
      props.accessibilityElementsHidden === true;
    expect(hostElementsWhere(full, isGlyph)).toHaveLength(1);
    expect(hostElementsWhere(compact, isGlyph)).toHaveLength(0);

    const withRetry = await render(
      <ErrorState title="Offline" compact retry={{ label: 'Try again', onPress: onRetry }} />,
    );
    fireEvent.press(withRetry.getByRole('button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
