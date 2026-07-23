/**
 * BrowseCategoryList — full-width kind rows without mid-word grid wraps.
 */
import { fireEvent, render } from '@testing-library/react-native';

import { BrowseCategoryList } from '../BrowseCategoryList';
import { BROWSE_CATEGORIES } from '../browse-categories';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

// eslint-disable-next-line import/first
import { router } from 'expo-router';

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
});

describe('BrowseCategoryList', () => {
  it('renders long kind labels in full on one row each', async () => {
    const { getByText } = await render(<BrowseCategoryList categories={BROWSE_CATEGORIES} />);

    expect(getByText('Organizations')).toBeTruthy();
    expect(getByText('Institutions')).toBeTruthy();
    expect(getByText('Publications')).toBeTruthy();
  });

  it('navigates to Explore with the selected kind', async () => {
    const { getByLabelText } = await render(<BrowseCategoryList categories={BROWSE_CATEGORIES} />);

    fireEvent.press(getByLabelText('Browse Schools on the map'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/explore',
      params: { kind: 'school' },
    });
  });
});
