import { render } from '@testing-library/react-native';
import { Plate } from '../Plate';

describe('Plate', () => {
  it('shows the photograph with its alt text and the credit line beside it', async () => {
    const { getByLabelText, getByText } = await render(
      <Plate
        source="https://example.com/photo.jpg"
        alt="Storefront in 1938"
        credit="Library of Congress"
        fallback={{ shape: 'pin' }}
      />,
    );
    expect(getByLabelText('Storefront in 1938')).toBeTruthy();
    expect(getByText('Library of Congress')).toBeTruthy();
  });
});
