import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CitationLink } from '../CitationLink';
import type { Citation } from '../types';

describe('CitationLink', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const safeCitation: Citation = {
    source: 'County historical register',
    label: 'Read the register entry',
    href: 'https://example.org/register',
  };

  it('shows the source label visibly, not a bare URL', async () => {
    const { getByText, queryByText } = await render(<CitationLink citation={safeCitation} isOnline />);
    expect(getByText('Read the register entry')).toBeTruthy();
    expect(getByText('County historical register')).toBeTruthy();
    expect(queryByText('https://example.org/register')).toBeNull();
  });

  it('opens a safe link through the allowlisted mechanism when tapped', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const { getByRole } = await render(<CitationLink citation={safeCitation} isOnline />);
    fireEvent.press(getByRole('link'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('https://example.org/register'));
  });

  it('shows an offline message and never calls Linking when tapped while offline', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const { getByRole, findByText } = await render(<CitationLink citation={safeCitation} isOnline={false} />);
    fireEvent.press(getByRole('link'));
    await findByText(/connect to the internet/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it('never renders an unsafe href as a live link', async () => {
    const unsafe: Citation = { source: 'Hostile', label: 'Click here', href: 'javascript:alert(1)' as never };
    const { queryByRole, getByText } = await render(<CitationLink citation={unsafe} isOnline />);
    expect(queryByRole('link')).toBeNull();
    expect(getByText('Click here')).toBeTruthy();
  });

  it('renders a withheldReason as explanatory text with no link', async () => {
    const withheld: Citation = { source: 'Protected source', label: 'Redacted', withheldReason: 'Source link withheld — protects a living person.' };
    const { queryByRole, getByText } = await render(<CitationLink citation={withheld} isOnline />);
    expect(queryByRole('link')).toBeNull();
    expect(getByText(/protects a living person/)).toBeTruthy();
  });
});
