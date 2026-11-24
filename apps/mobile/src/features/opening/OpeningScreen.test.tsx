import { fireEvent, render } from '@testing-library/react-native';

import { normalizeEntity } from '@/features/entity/normalize';
import { fullEntityFixture } from '@/features/entity/testFixtures';
import { isOpeningEligible, OpeningScreen } from './OpeningScreen';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/features/entity/dataClient', () => ({
  createRuntimeEntityDataDeps: () => new Promise(() => {}),
}));

const noop = () => {};

describe('OpeningScreen', () => {
  it('opens on History with Skip on screen and its position in words', async () => {
    const onDone = jest.fn();
    const { getByLabelText, getByText } = await render(
      <OpeningScreen onDone={onDone} onOpenRecord={noop} onOpenRoute={noop} />,
    );
    expect(getByLabelText('Scene 1 of 6: History')).toBeTruthy();
    expect(getByText('History is the story that got told, so keep going and watch the word change.')).toBeTruthy();
    await fireEvent.press(getByLabelText('Skip to the archive'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('names where Next goes', async () => {
    const { getByLabelText } = await render(
      <OpeningScreen onDone={noop} onOpenRecord={noop} onOpenRoute={noop} />,
    );
    expect(getByLabelText('Next: His story')).toBeTruthy();
  });

  it('reads each heading whole, with one italic word inside it', async () => {
    const { getByLabelText } = await render(
      <OpeningScreen onDone={noop} onOpenRecord={noop} onOpenRoute={noop} />,
    );
    for (const heading of ['His story', 'Her story', 'Your story', 'Their story']) {
      expect(getByLabelText(heading, { includeHiddenElements: true })).toBeTruthy();
    }
  });
});

describe('isOpeningEligible', () => {
  const place = normalizeEntity(fullEntityFixture('place'))!;
  const { sensitivity: _s, sensitivityClass: _c, ...plain } = place;

  it('refuses a harm-adjacent record, a person and a record with no photograph', () => {
    expect(isOpeningEligible(place)).toBe(false);
    expect(isOpeningEligible({ ...plain, kind: 'person' })).toBe(false);
    const { primaryImage: _image, ...bare } = plain;
    expect(isOpeningEligible(bare)).toBe(false);
  });

  it('accepts a photographed place that is not thinly evidenced', () => {
    expect(isOpeningEligible(plain)).toBe(true);
  });
});
