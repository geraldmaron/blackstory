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

const mockResolveApiBaseUrl = jest.fn(() => 'https://api.example.com');

jest.mock('@/security', () => ({
  DEFAULT_API_BASE_URL: 'https://api.example.com',
  resolveApiBaseUrl: () => mockResolveApiBaseUrl(),
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

  it('renders prod-default offline copy in dev', async () => {
    mockResolveApiBaseUrl.mockReturnValue('https://api.example.com');
    const { getByText } = await render(<ApiStatusBanner />);
    expect(getByText('Live data unavailable')).toBeTruthy();
    expect(getByText(/Set API_BASE_URL in \.env\.local/)).toBeTruthy();
    expect(getByText(/pnpm dev:mobile/)).toBeTruthy();
    expect(getByText(/Explore uses demo fixtures until then/)).toBeTruthy();
  });

  it('renders waiting copy when a local API URL is configured', async () => {
    mockResolveApiBaseUrl.mockReturnValue('http://127.0.0.1:8080');
    const { getByText } = await render(<ApiStatusBanner />);
    expect(getByText('Waiting for local API')).toBeTruthy();
    expect(getByText(/Connecting to http:\/\/127\.0\.0\.1:8080/)).toBeTruthy();
    expect(getByText(/pnpm dev:mobile/)).toBeTruthy();
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

  it('uses roomier outer wrap spacing when compact is false', async () => {
    const { getByRole } = await render(<ApiStatusBanner compact={false} />);
    const notice = getByRole('alert');
    const wrap = notice.parent;

    const wrapStyles = Array.isArray(wrap?.props.style) ? wrap.props.style : [wrap?.props.style];
    expect(wrapStyles).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: space['4'] })]),
    );
  });
});
