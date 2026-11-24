import { render } from '@testing-library/react-native';
import { normalizeEntity } from '../normalize';
import { IntroSection } from '../sections/IntroSection';
import { fullEntityFixture } from '../testFixtures';

describe('IntroSection photograph', () => {
  // The full fixture carries a credited image and a sensitivity flag.
  const sensitive = normalizeEntity(fullEntityFixture('place'))!;
  const { sensitivity: _s, sensitivityClass: _c, ...plain } = sensitive;

  it('shows a credited photograph as an exhibit with its credit as the receipt', async () => {
    const { getByTestId, getByText } = await render(<IntroSection entity={plain} />);
    expect(getByTestId('exhibit-label').props.children).toBe('Photograph · date not on record');
    expect(getByTestId('exhibit-crop-marks', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText(plain.primaryImage!.credit)).toBeTruthy();
  });

  it('gives a sensitive record the quiet frame: no crop marks, still credited', async () => {
    const { queryByTestId, getByText } = await render(<IntroSection entity={sensitive} />);
    expect(queryByTestId('exhibit-crop-marks', { includeHiddenElements: true })).toBeNull();
    expect(getByText(sensitive.primaryImage!.credit)).toBeTruthy();
  });

  it('shows no photograph exhibit, and no stand-in picture, when the record has none', async () => {
    const { primaryImage: _image, ...bare } = plain;
    const { queryByTestId } = await render(<IntroSection entity={bare} />);
    expect(queryByTestId('entity-photograph')).toBeNull();
    expect(queryByTestId('image-fallback')).toBeNull();
  });
});
