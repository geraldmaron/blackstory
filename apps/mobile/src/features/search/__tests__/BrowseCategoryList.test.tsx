/**
 * BrowseCategoryList — full-width kind rows without mid-word grid wraps, and a category tap that
 * stays inside Records (repo-awboi).
 */
import { fireEvent, render } from '@testing-library/react-native';

import { BrowseCategoryList, showCategoryOnMap } from '../BrowseCategoryList';
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
    const { getByText } = await render(
      <BrowseCategoryList categories={BROWSE_CATEGORIES} onSelectCategory={jest.fn()} />,
    );

    expect(getByText('Organizations')).toBeTruthy();
    expect(getByText('Institutions')).toBeTruthy();
    expect(getByText('Publications')).toBeTruthy();
  });

  it('lists the kind inside Records rather than leaving for the map', async () => {
    const onSelectCategory = jest.fn();
    const { getByLabelText } = await render(
      <BrowseCategoryList categories={BROWSE_CATEGORIES} onSelectCategory={onSelectCategory} />,
    );

    fireEvent.press(getByLabelText('List Schools in Records'));

    expect(onSelectCategory).toHaveBeenCalledWith('school');
    // The whole point of the bug: a category tap must not navigate away from the tab.
    expect(router.push).not.toHaveBeenCalled();
  });

  it('keeps the map reachable as its own explicit action', () => {
    showCategoryOnMap('school');

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/explore',
      params: { kind: 'school' },
    });
  });
});
