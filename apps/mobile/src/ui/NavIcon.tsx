/**
 * Brand navigation glyphs for tabs and menu rows — Ionicons at a fixed 22dp box with copper
 * accent when selected.
 *
 * The names here are the SEMANTIC ids from `@repo/public-contracts/destinations`, and this file
 * is the only place in the native app allowed to know an Ionicon name. Web maps the same ids to
 * its own glyphs, so the two surfaces cannot end up drawing different pictures for one idea.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from './tokens';

export type NavIconName =
  | 'explore'
  | 'stories'
  | 'records'
  | 'rooms'
  | 'more'
  | 'search'
  | 'about'
  | 'questions'
  | 'privacy'
  | 'errata'
  | 'methodology'
  | 'correction'
  | 'data'
  | 'books'
  | 'collection'
  | 'submit'
  | 'support'
  | 'memorial'
  | 'time'
  | 'evidence'
  | 'source'
  | 'design'
  | 'home'
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
  | 'invention'
  | 'other';

type IonName = keyof typeof Ionicons.glyphMap;

const OUTLINE: Record<NavIconName, IonName> = {
  explore: 'map-outline',
  stories: 'book-outline',
  records: 'list-outline',
  rooms: 'grid-outline',
  more: 'ellipsis-horizontal',
  search: 'search-outline',
  about: 'information-circle-outline',
  questions: 'help-circle-outline',
  privacy: 'shield-checkmark-outline',
  errata: 'create-outline',
  methodology: 'flask-outline',
  correction: 'chatbox-ellipses-outline',
  data: 'bar-chart-outline',
  books: 'library-outline',
  collection: 'layers-outline',
  submit: 'send-outline',
  support: 'heart-outline',
  memorial: 'flower-outline',
  time: 'time-outline',
  evidence: 'shield-outline',
  source: 'link-outline',
  design: 'color-palette-outline',
  home: 'home-outline',
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
  invention: 'bulb-outline',
  other: 'ellipse-outline',
};

const FILLED: Partial<Record<NavIconName, IonName>> = {
  explore: 'map',
  stories: 'book',
  records: 'list',
  more: 'ellipsis-horizontal',
  search: 'search',
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
    case 'invention':
      return 'invention';
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
