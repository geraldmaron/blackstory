/**
 * Decorative glyph beside record anatomy fact labels. Icons are never the only
 * signal — visible mono labels always pair with glyphs (WCAG 1.4.1). When a
 * glyph cannot resolve, the label alone remains readable.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { navIconForEntityKind, useConfidenceColors, useThemeColors } from '@/ui';
import type { ConfidenceTierKey } from './entity-anatomy-facts';

type IonName = keyof typeof Ionicons.glyphMap;

export type EditionFactIconProps =
  | {
      readonly variant: 'record-kind';
      readonly kind: string;
      readonly muted?: boolean;
    }
  | {
      readonly variant: 'record-where';
    }
  | {
      readonly variant: 'record-era';
    }
  | {
      readonly variant: 'record-evidence';
      readonly tier: ConfidenceTierKey;
    };

const EVIDENCE_ICONS: Readonly<Record<ConfidenceTierKey, IonName>> = {
  high: 'checkmark-circle-outline',
  medium: 'ellipse-outline',
  low: 'alert-circle-outline',
  unrated: 'help-circle-outline',
};

function kindIonName(kind: string): IonName {
  const nav = navIconForEntityKind(kind);
  switch (nav) {
    case 'place':
      return 'location-outline';
    case 'school':
      return 'school-outline';
    case 'event':
      return 'calendar-outline';
    case 'institution':
      return 'business-outline';
    default:
      return 'book-outline';
  }
}

function resolveIcon(props: EditionFactIconProps): IonName | undefined {
  if (props.variant === 'record-kind') return kindIonName(props.kind);
  if (props.variant === 'record-where') return 'location-outline';
  if (props.variant === 'record-era') return 'calendar-outline';
  return EVIDENCE_ICONS[props.tier];
}

export function EditionFactIcon(props: EditionFactIconProps) {
  const theme = useThemeColors();
  const confidence = useConfidenceColors();
  const glyph = resolveIcon(props);
  if (!glyph) return null;

  let color = theme.inkMuted;
  if (props.variant === 'record-evidence' && props.tier !== 'unrated') {
    color = confidence[props.tier].fg;
  } else if (props.variant === 'record-kind' && props.muted !== true) {
    color = theme.accentGraphic;
  }

  return (
    <View
      style={styles.box}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={glyph} size={14} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
