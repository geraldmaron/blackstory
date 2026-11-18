import { render } from '@testing-library/react-native';
import { normalizeEntity } from '../normalize';
import { IntroSection } from '../sections/IntroSection';
import { fullEntityFixture } from '../testFixtures';

describe('IntroSection photograph', () => {
  // The full fixture carries a credited image and a sensitivity flag.
  const sensitive = normalizeEntity(fullEntityFixture('place'))!;
  const { sensitivity: _s, sensitivityClass: _c, ...plain } = sensitive;

  it('shows a credited photograph as a plate with its credit line', async () => {
    const { getByTestId } = await render(<IntroSection entity={plain} />);
    expect(getByTestId('plate-credit').props.children).toBe(plain.primaryImage!.credit);
  });

  it('keeps the photograph plain, still credited, on a sensitive record', async () => {
    const { queryByTestId, getByText } = await render(<IntroSection entity={sensitive} />);
    expect(queryByTestId('plate')).toBeNull();
    expect(getByText(sensitive.primaryImage!.credit)).toBeTruthy();
  });
});
