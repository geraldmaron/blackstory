/**
 * Shared "list of rows, tap to navigate" screen body (MOB-015 requirement #1). Used by the Learn
 * tab index, the More tab index, and `/learn/[section]/index.tsx`'s slug list for a multi-page
 * section — one presentational component instead of three near-duplicate screens.
 */
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListRow, Text } from '@/ui';

export interface SectionListRow {
  readonly key: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly onPress: () => void;
}

export interface SectionListScreenProps {
  readonly title: string;
  readonly intro?: string;
  readonly rows: readonly SectionListRow[];
}

export function SectionListScreen({ title, intro, rows }: SectionListScreenProps) {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text variant="title" isHeading>
          {title}
        </Text>
        {intro ? (
          <Text variant="body" colorRole="inkMuted">
            {intro}
          </Text>
        ) : null}
        {rows.map((row, index) => (
          <ListRow
            key={row.key}
            title={row.title}
            subtitle={row.subtitle}
            onPress={row.onPress}
            showDivider={index < rows.length - 1}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
