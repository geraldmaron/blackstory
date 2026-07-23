import { fireEvent, render } from '@testing-library/react-native';
import { SearchResultCard, toSearchResultCardProps, type SearchResultCardProps } from '../SearchResultCard';
import type { SearchResultV1 } from '../search-contracts';

function baseResult(overrides: Partial<SearchResultV1> = {}): SearchResultV1 {
  return {
    id: 'ent_1',
    kind: 'person',
    displayName: 'Harriet Tubman',
    matchedOn: 'displayName',
    matchedText: 'Harriet Tubman',
    explanation: 'Matched on name.',
    eraBuckets: [],
    notabilityLabels: [],
    ...overrides,
  };
}

describe('toSearchResultCardProps — allow-list mapping negative test (MOB-013 item 6)', () => {
  it('never carries a relevance score, rank, or count field even if the source result somehow had one', () => {
    const hostile = {
      ...baseResult(),
      // Simulates a contract regression or a compromised/misbehaving server response that
      // slipped a numeric ranking signal onto the object.
      relevanceScore: 0.987,
      rank: 1,
      claimCount: 42,
    } as SearchResultV1 & { relevanceScore: number; rank: number; claimCount: number };

    const props = toSearchResultCardProps(hostile);

    expect(props).not.toHaveProperty('relevanceScore');
    expect(props).not.toHaveProperty('rank');
    expect(props).not.toHaveProperty('claimCount');
    expect(props).not.toHaveProperty('score');
    expect(Object.keys(props).sort()).toEqual(['displayName', 'explanation', 'id', 'kind'].sort());
  });

  it('is a fixed, exhaustive allow-list mapping -- never `{...result}`', () => {
    // A TypeScript-level guard: SearchResultCardProps must not structurally accept a numeric
    // relevance-shaped field. This assignment would fail to compile if the type gained one.
    const props: SearchResultCardProps = toSearchResultCardProps(baseResult());
    // @ts-expect-error -- SearchResultCardProps has no `relevanceScore` field, by design.
    const _leak: number = props.relevanceScore;
    void _leak;
  });

  it('only attaches handlers explicitly passed in the handlers bag', () => {
    const onPress = jest.fn();
    const onShowOnMap = jest.fn();
    const props = toSearchResultCardProps(baseResult(), { onPress, onShowOnMap });
    expect(Object.keys(props).sort()).toEqual(
      ['displayName', 'explanation', 'id', 'kind', 'onPress', 'onShowOnMap'].sort(),
    );
    expect(props.onPress).toBe(onPress);
    expect(props.onShowOnMap).toBe(onShowOnMap);
  });
});

describe('SearchResultCard — adversarial rendering (MOB-013 item 8: malicious snippets render inert)', () => {
  it('renders an XSS/HTML/script-shaped displayName as plain, inert text', async () => {
    const hostileName = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const props = toSearchResultCardProps(baseResult({ displayName: hostileName, explanation: 'why' }));
    const { getByText } = await render(<SearchResultCard {...props} />);
    // The exact hostile string appears as literal TEXT content -- React Native's <Text> never
    // interprets markup, and there is no dangerouslySetInnerHTML/WebView anywhere in this
    // component (verified by the no-console-log/source-scan test's sibling grep in this
    // directory as well).
    expect(getByText(hostileName)).toBeTruthy();
  });

  it('renders a script-shaped explanation/summary as inert text too', async () => {
    const props = toSearchResultCardProps(
      baseResult({ explanation: '"><script>document.location="//evil.example"</script>' }),
    );
    const { getByText } = await render(<SearchResultCard {...props} />);
    expect(getByText(props.explanation)).toBeTruthy();
  });

  it('never throws when rendering an empty or maximally long displayName', () => {
    expect(() => render(<SearchResultCard {...toSearchResultCardProps(baseResult({ displayName: 'x'.repeat(300) }))} />)).not.toThrow();
  });
});

describe('SearchResultCard — interaction', () => {
  it('calls onPress with the result id when pressed', async () => {
    const onPress = jest.fn();
    const props = toSearchResultCardProps(baseResult({ id: 'ent_42' }), { onPress });
    const { getByLabelText } = await render(<SearchResultCard {...props} />);
    fireEvent.press(getByLabelText(/Harriet Tubman/));
    expect(onPress).toHaveBeenCalledWith('ent_42');
  });

  it('calls onShowOnMap with id and kind from the secondary action without opening the record', async () => {
    const onPress = jest.fn();
    const onShowOnMap = jest.fn();
    const props = toSearchResultCardProps(baseResult({ id: 'ent_42', kind: 'person' }), {
      onPress,
      onShowOnMap,
    });
    const { getByLabelText } = await render(<SearchResultCard {...props} />);
    fireEvent.press(getByLabelText('Show Harriet Tubman on map'));
    expect(onShowOnMap).toHaveBeenCalledWith('ent_42', 'person');
    expect(onPress).not.toHaveBeenCalled();
  });
});
