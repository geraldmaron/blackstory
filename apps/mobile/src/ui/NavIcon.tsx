/**
 * Brand navigation glyphs for tabs and menu rows — Ionicons at a fixed 22dp box with copper
 * accent when selected. Replaces broken placeholder triangles from unset tabBarIcon slots.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from './tokens';

export type NavIconName =
  | 'explore'
  | 'search'
  | 'history'
  | 'stories'
  | 'more'
  | 'about'
  | 'facts'
  | 'legal'
  | 'privacy'
  | 'errata'
  | 'myths'
  | 'methodology'
  | 'corrections'
  | 'data'
  | 'books'
  | 'themes'
  | 'lawRef'
  | 'submit'
  | 'story'
  | 'place'
  | 'school'
  | 'event'
  | 'institution'
  | 'person'
  | 'law'
  | 'case'
  | 'movement'
  | 'organization'
  | 'publication'
  | 'artifact'
  | 'other';

type IonName = keyof typeof Ionicons.glyphMap;

const OUTLINE: Record<NavIconName, IonName> = {
  explore: 'map-outline',
  search: 'search-outline',
  history: 'time-outline',
  stories: 'book-outline',
  more: 'ellipsis-horizontal',
  about: 'information-circle-outline',
  facts: 'list-outline',
  legal: 'document-text-outline',
  privacy: 'shield-checkmark-outline',
  errata: 'create-outline',
  myths: 'help-circle-outline',
  methodology: 'flask-outline',
  corrections: 'chatbox-ellipses-outline',
  data: 'bar-chart-outline',
  books: 'library-outline',
  themes: 'layers-outline',
  lawRef: 'scale-outline',
  submit: 'send-outline',
  story: 'newspaper-outline',
  place: 'location-outline',
  school: 'school-outline',
  event: 'calendar-outline',
  institution: 'business-outline',
  person: 'person-outline',
  law: 'document-text-outline',
  case: 'briefcase-outline',
  movement: 'flag-outline',
  organization: 'people-outline',
  publication: 'newspaper-outline',
  artifact: 'cube-outline',
  other: 'ellipse-outline',
};

const FILLED: Partial<Record<NavIconName, IonName>> = {
  explore: 'map',
  search: 'search',
  history: 'time',
  stories: 'book',
  more: 'ellipsis-horizontal',
};

export type NavIconProps = {
  readonly name: NavIconName;
  readonly size?: number;
  readonly selected?: boolean;
  readonly accessibilityHidden?: boolean;
};

export function NavIcon({
  name,
  size = 22,
  selected = false,
  accessibilityHidden = true,
}: NavIconProps) {
  const theme = useThemeColors();
  const glyph = (selected && FILLED[name]) || OUTLINE[name] || 'ellipse-outline';
  const color = selected ? theme.accent : theme.inkMuted;

  return (
    <View
      style={styles.box}
      accessibilityElementsHidden={accessibilityHidden}
      importantForAccessibility={accessibilityHidden ? 'no-hide-descendants' : 'auto'}
    >
      <Ionicons name={glyph} size={size} color={color} />
    </View>
  );
}

/** Maps entity kind strings to navigation icons for list rows and search results. */
export function navIconForEntityKind(kind: string): NavIconName {
  switch (kind) {
    case 'person':
      return 'person';
    case 'place':
      return 'place';
    case 'school':
      return 'school';
    case 'event':
      return 'event';
    case 'institution':
      return 'institution';
    case 'law':
      return 'law';
    case 'case':
      return 'case';
    case 'movement':
      return 'movement';
    case 'organization':
      return 'organization';
    case 'publication':
      return 'publication';
    case 'artifact':
      return 'artifact';
    default:
      return 'other';
  }
}

const styles = StyleSheet.create({
  box: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
