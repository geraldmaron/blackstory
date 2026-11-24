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
    expect(getByLabelText('Well evidenced, 4 sources')).toBeTruthy();
  });

  it('says one source, singular, when there is one', async () => {
    const { getByLabelText } = await render(<RecordMeter tier="low" sourceCount={1} />);
    expect(getByLabelText('Thinly evidenced, 1 source')).toBeTruthy();
  });

  it('says nothing about sources when the surface does not know the count', async () => {
    const { getByLabelText } = await render(<RecordMeter tier="medium" />);
    expect(getByLabelText('Partly evidenced')).toBeTruthy();
  });

  it('treats unrated as unassessed, not as a low grade', async () => {
    const { getByLabelText } = await render(<RecordMeter tier="unrated" sourceCount={0} />);
    expect(getByLabelText('Not graded, 0 sources')).toBeTruthy();
  });

  it('prints no letter: the filled bars are the glyph and the words sit beside it', async () => {
    const { queryByText } = await render(<RecordMeter tier="high" />);
    expect(queryByText(/^[ABC·]$/)).toBeNull();
  });

  it('goes silent for assistive tech when a row already speaks the whole record', async () => {
    const { queryByLabelText, getByTestId } = await render(
      <RecordMeter tier="high" sourceCount={2} decorative testID="meter" />,
    );
    expect(queryByLabelText('Well evidenced, 2 sources')).toBeNull();
    expect(
      getByTestId('meter', { includeHiddenElements: true }).props.accessibilityElementsHidden,
    ).toBe(true);
  });
});
