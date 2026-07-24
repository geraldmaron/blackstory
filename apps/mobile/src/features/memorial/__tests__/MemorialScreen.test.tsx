/**
 * Smoke tests for Memorial screen.
 */
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
  },
}));

jest.mock('@/features/entity/maps-handoff', () => ({
  openExternalMaps: jest.fn(async () => 'opened'),
}));

import { MemorialScreen } from '../MemorialScreen';
import { openExternalMaps } from '@/features/entity/maps-handoff';

describe('MemorialScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(openExternalMaps).mockClear();
  });

  it('renders names-forward list and pulse', async () => {
    const { getByText, getByLabelText } = await render(<MemorialScreen />);
    expect(getByText('Memorial')).toBeTruthy();
    expect(getByText('Memorial pulse')).toBeTruthy();
    expect(getByLabelText('Search memorial names')).toBeTruthy();
    expect(getByText('Trayvon Martin')).toBeTruthy();
  });

  it('opens linked entity when a linked name is pressed', async () => {
    const { getByText } = await render(<MemorialScreen />);
    fireEvent.press(getByText('Trayvon Martin'));
    expect(mockPush).toHaveBeenCalledWith('/entity/ent_trayvon_martin_001');
  });

  it('offers Maps handoff for mapped names', async () => {
    const { getAllByText } = await render(<MemorialScreen />);
    const mapsButtons = getAllByText('Open in Maps');
    expect(mapsButtons.length).toBeGreaterThan(0);
    fireEvent.press(mapsButtons[0]!);
    expect(openExternalMaps).toHaveBeenCalled();
  });
});
