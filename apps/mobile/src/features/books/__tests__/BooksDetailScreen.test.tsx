/**
 * Smoke tests for Banned books detail screen.
 */
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('@/features/entity/linking', () => ({
  openExternalLink: jest.fn(async () => 'opened'),
}));

import { BooksDetailScreen } from '../BooksDetailScreen';

describe('BooksDetailScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it('renders context and challenges for a known slug', async () => {
    const { getByText } = await render(<BooksDetailScreen slug="the-bluest-eye" />);
    expect(getByText(/The Bluest Eye/i)).toBeTruthy();
    expect(getByText('About this title')).toBeTruthy();
    expect(getByText('States on challenge lists')).toBeTruthy();
  });

  it('shows missing state for unknown slug', async () => {
    const { getByText } = await render(<BooksDetailScreen slug="no-such-title" />);
    expect(getByText('Book not found')).toBeTruthy();
    fireEvent.press(getByText('Back to Banned books'));
    expect(mockReplace).toHaveBeenCalledWith('/books');
  });
});
