import { act, render } from '@testing-library/react-native';
import { Image } from '../Image';

describe('Image', () => {
  it('renders the EntityMark geometric fallback (not a broken-image glyph) when source is missing', async () => {
    const { getByRole } = await render(
      <Image source={undefined} alt="Portrait of Ida B. Wells" fallback={{ shape: 'book' }} />,
    );
    const mark = getByRole('image');
    expect(mark.props.accessibilityLabel).toContain('Portrait of Ida B. Wells');
  });

  it('renders the network image with the required alt text when a source is provided', async () => {
    const { getByLabelText } = await render(
      <Image
        source="https://example.com/photo.jpg"
        alt="A rally in 1965"
        fallback={{ shape: 'pin' }}
      />,
    );
    expect(getByLabelText('A rally in 1965')).toBeTruthy();
  });

  it("captions a failed load as a failed load, not as the caller's rights status", async () => {
    const { getByLabelText, getByRole } = await render(
      <Image
        source="https://example.com/photo.jpg"
        alt="A rally in 1965"
        fallback={{ shape: 'pin', reason: 'pending-rights-review' }}
      />,
    );
    await act(async () => {
      getByLabelText('A rally in 1965').props.onError({ nativeEvent: { error: 'network' } });
    });
    const label = getByRole('image').props.accessibilityLabel;
    expect(label).toContain('could not be loaded');
    expect(label).not.toContain('rights');
  });
});
