/**
 * Full-width category browse rows for Records. Avoids two-up grid mid-word wraps by giving each
 * kind label the full content width at compact density.
 *
 * A category row lists that kind inside Records. It used to `router.push('/explore')` with the
 * kind as a param, which answered a different question — where are these on the map — and
 * stranded a reader who came to the archive precisely because they did not want to start from
 * geography (repo-awboi). The map is still one tap away, as its own action rather than as the
 * only outcome.
 */
import { router } from 'expo-router';

import { ListRow, NavIcon, navIconForEntityKind } from '@/ui';

import type { BrowseCategory } from './browse-categories';

export type BrowseCategoryListProps = {
  readonly categories: readonly BrowseCategory[];
  /** Applies the kind filter in place. Records lists it without leaving the tab. */
  readonly onSelectCategory: (kind: string) => void;
};

export function BrowseCategoryList({ categories, onSelectCategory }: BrowseCategoryListProps) {
  return (
    <>
      {categories.map((category, index) => (
        <ListRow
          key={category.kind}
          density="compact"
          title={category.label}
          leading={<NavIcon name={navIconForEntityKind(category.kind)} size={18} />}
          showChevron
          onPress={() => onSelectCategory(category.kind)}
          accessibilityLabel={`List ${category.label} in Records`}
          showDivider={index < categories.length - 1}
        />
      ))}
    </>
  );
}

/** The explicit map path for a kind the reader is already looking at in Records. */
export function showCategoryOnMap(kind: string): void {
  router.push({ pathname: '/explore', params: { kind } });
}
