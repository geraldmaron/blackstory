/**
 * The meter is the phone's half of one shared evidence language, so these assert the two rules
 * that language rests on: unrated fills nothing and is never a fourth grade, and the mark never
 * speaks in color alone.
 */
import { render } from '@testing-library/react-native';

import { RecordMeter } from '../RecordMeter';

describe('RecordMeter', () => {
  it('speaks the grade and the source count in one sentence', async () => {
    const { getByLabelText } = await render(<RecordMeter tier="high" sourceCount={4} />);
    expect(getByLabelText('Evidence grade A, 4 sources')).toBeTruthy();
  });

  it('says one source, singular, when there is one', async () => {
    const { getByLabelText } = await render(<RecordMeter tier="low" sourceCount={1} />);
    expect(getByLabelText('Evidence grade C, 1 source')).toBeTruthy();
  });

  it('says nothing about sources when the surface does not know the count', async () => {
    const { getByLabelText } = await render(<RecordMeter tier="medium" />);
    expect(getByLabelText('Evidence grade B')).toBeTruthy();
  });

  it('treats unrated as unassessed, not as a low grade', async () => {
    const { getByLabelText, getByText } = await render(
      <RecordMeter tier="unrated" sourceCount={0} />,
    );
    expect(getByLabelText('Evidence not graded, 0 sources')).toBeTruthy();
    // The middot is the placeholder for "no letter". A "D" here would invent a fourth grade.
    expect(getByText('·')).toBeTruthy();
  });

  it('carries the letter beside the bars, so color is never the only cue', async () => {
    const { getByText } = await render(<RecordMeter tier="high" />);
    expect(getByText('A')).toBeTruthy();
  });

  it('goes silent for assistive tech when a row already speaks the whole record', async () => {
    const { queryByLabelText, getByTestId } = await render(
      <RecordMeter tier="high" sourceCount={2} decorative testID="meter" />,
    );
    expect(queryByLabelText('Evidence grade A, 2 sources')).toBeNull();
    expect(
      getByTestId('meter', { includeHiddenElements: true }).props.accessibilityElementsHidden,
    ).toBe(true);
  });
});
