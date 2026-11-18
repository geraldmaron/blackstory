/**
 * The phone files no corrections itself: the sheet opens the web form, carrying only the
 * validated record id.
 */
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), canGoBack: () => false, back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

// eslint-disable-next-line import/first
import CorrectionsSubmitSheet from './submit';

describe('CorrectionsSubmitSheet', () => {
  it('opens the web corrections form for the record it came from', async () => {
    mockParams = { entityId: 'ent_abc123' };
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const { getByText } = await render(<CorrectionsSubmitSheet />);
    fireEvent.press(getByText('Open corrections form'));
    expect(spy).toHaveBeenCalledWith(
      'https://blackstory.app/corrections?target=ent_abc123&targetType=entity',
    );
  });

  it('opens the bare form when no valid record id is given', async () => {
    mockParams = { entityId: '../../admin' };
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const { getByText } = await render(<CorrectionsSubmitSheet />);
    fireEvent.press(getByText('Open corrections form'));
    expect(spy).toHaveBeenLastCalledWith('https://blackstory.app/corrections');
  });
});
