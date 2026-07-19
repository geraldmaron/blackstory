import { render } from '@testing-library/react-native';
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
});
