/**
 * Presentational EntitySessionNav — Previous / Random / Next labels and a11y.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { EntitySessionNav } from '../EntitySessionNav';

describe('EntitySessionNav', () => {
  it('exposes Previous / Random off / Next with web-parity a11y labels', async () => {
    const onPrevious = jest.fn();
    const onNext = jest.fn();
    const onRandomToggle = jest.fn();
    const { getByTestId, getByLabelText } = await render(
      <EntitySessionNav
        canPrevious
        canNext
        randomEnabled={false}
        onPrevious={onPrevious}
        onNext={onNext}
        onRandomToggle={onRandomToggle}
      />,
    );

    expect(getByTestId('entity-session-nav')).toBeTruthy();
    expect(getByLabelText('Record navigation')).toBeTruthy();
    expect(getByLabelText('Random order: off')).toBeTruthy();
    expect(getByLabelText('Next record in list')).toBeTruthy();
    fireEvent.press(getByLabelText('Previous record'));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('exposes Random on and Next random labels when random is enabled', async () => {
    const { getByLabelText, getByText } = await render(
      <EntitySessionNav
        canPrevious={false}
        canNext
        randomEnabled={true}
        onPrevious={jest.fn()}
        onNext={jest.fn()}
        onRandomToggle={jest.fn()}
      />,
    );
    expect(getByText('Random: on')).toBeTruthy();
    expect(getByLabelText('Random order: on')).toBeTruthy();
    expect(getByLabelText('Next random record')).toBeTruthy();
  });
});
