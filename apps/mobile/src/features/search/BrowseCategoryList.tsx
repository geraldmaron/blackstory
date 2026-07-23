/**
 * Full-width category browse rows for History find-in-time. Avoids two-up grid
 * mid-word wraps by giving each kind label the full content width at compact density.
 */
import { router } from 'expo-router';

import { ListRow, NavIcon, navIconForEntityKind } from '@/ui';

import type { BrowseCategory } from './browse-categories';

export type BrowseCategoryListProps = {
  readonly categories: readonly BrowseCategory[];
};

export function BrowseCategoryList({ categories }: BrowseCategoryListProps) {
  return (
    <>
      {categories.map((category, index) => (
        <ListRow
          key={category.kind}
          density="compact"
          title={category.label}
          leading={<NavIcon name={navIconForEntityKind(category.kind)} size={18} />}
          showChevron
          onPress={() => router.push({ pathname: '/explore', params: { kind: category.kind } })}
          accessibilityLabel={`Browse ${category.label} on the map`}
          showDivider={index < categories.length - 1}
        />
      ))}
    </>
  );
}
