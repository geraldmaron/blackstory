/**
 * ApiStatusBanner — dev-only offline strip with optional compact density.
 */
import { render } from '@testing-library/react-native';

import { ApiStatusBanner } from '../ApiStatusBanner';
import { space } from '../tokens';

jest.mock('@/runtime', () => ({
  useAppRuntimeOptional: () => ({
    lastBootstrapSync: { status: 'offline', stamp: undefined },
  }),
}));

jest.mock('@/security', () => ({
  DEFAULT_API_BASE_URL: 'https://api.example.com',
  resolveApiBaseUrl: () => 'https://api.example.com',
}));

describe('ApiStatusBanner', () => {
  const globalDev = globalThis as typeof globalThis & { __DEV__?: boolean };
  const originalDev = globalDev.__DEV__;

  beforeEach(() => {
    globalDev.__DEV__ = true;
  });

  afterEach(() => {
    globalDev.__DEV__ = originalDev;
  });

  it('renders compact warning copy when offline in dev', async () => {
    const { getByText } = await render(<ApiStatusBanner />);
    expect(getByText('Live data unavailable')).toBeTruthy();
    expect(getByText(/Set API_BASE_URL in \.env\.local, start api-public, and restart Metro/)).toBeTruthy();
    expect(getByText(/Explore uses demo fixtures until then/)).toBeTruthy();
  });

  it('uses compact spacing on the outer wrap by default', async () => {
    const { getByRole } = await render(<ApiStatusBanner />);
    const notice = getByRole('alert');
    const wrap = notice.parent;

    const wrapStyles = Array.isArray(wrap?.props.style) ? wrap.props.style : [wrap?.props.style];
    expect(wrapStyles).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: space['2'] })]),
    );
  });
});
