/**
 * The v9 room kit — the shared surface vocabulary for Reading, Record and Utility rooms.
 *
 * Design law: docs/ui/archive/design-direction-v9-surfaces.md §2 and §4. Every room imports from here
 * and from exactly one of `reading-room.css`, `record-page.css` or `utility.css`. Nothing
 * under `apps/web/src/app` may add another `*-edition.css` or `*-panel-chrome.ts`; the guard
 * lives in `room-kit.test.tsx`.
 */

export { Room, type RoomProps, type RoomWidth } from './Room';
export { DocumentColophon, type EntryPosture, type DocumentColophonProps } from './EntryPosture';
export type { RailEntry } from './RoomRail';
export { Breadcrumb, type BreadcrumbProps } from './Breadcrumb';
export { parentCrumb, resolveTrail, roomLabelFor, type RoomCrumb } from './room-trail';
export {
  GroupHeading,
  CardGrid,
  RoomCard,
  type GroupHeadingProps,
  type CardGridProps,
  type RoomCardProps,
} from './RoomCards';
export {
  RoomSection,
  RoomFactList,
  RoomHandoff,
  type RoomSectionProps,
  type RoomFact,
  type RoomHandoffProps,
} from './RoomSection';
export { RoomJump, type RoomJumpProps, type RoomJumpSection } from './RoomJump';
export {
  FindBar,
  FindBarFilters,
  type FindBarFiltersProps,
  type FindBarProps,
  type FindBarChip,
  type FindBarChipRow,
  type FindBarConstraint,
} from './FindBar';
export { Prose, RecordRef, type ProseProps, type RecordRefProps } from './Prose';
export { ReadingProgress, type ReadingProgressProps } from './ReadingProgress';
export {
  ArchiveFigure,
  SourceList,
  Connections,
  TrustBlock,
  Anatomy,
  Precision,
  type RoomSource,
  type SourceListProps,
  type RoomConnection,
  type ConnectionsProps,
  type TrustFact,
  type TrustBlockProps,
  type AnatomyCell,
  type AnatomyProps,
  type PrecisionProps,
} from './Evidence';
export {
  HairlineIndex,
  type HairlineIndexProps,
  type IndexFilter,
  type IndexRow,
} from './HairlineIndex';
export { DataTable, type DataTableProps, type DataTableColumn } from './DataTable';
export {
  Disclosure,
  Field,
  ChoiceField,
  UtilityCard,
  UtilityStep,
  fieldControlProps,
  fieldErrorId,
  fieldHintId,
  type DisclosureProps,
  type FieldProps,
  type ChoiceFieldProps,
  type Choice,
  type UtilityCardProps,
  type UtilityStepProps,
} from './Utility';
export {
  MapMoment,
  MapMomentStage,
  useMapMomentFrame,
  pickLiveMoment,
  resolveMomentCamera,
  MOMENT_VISIBILITY_FLOOR,
  type MapMomentProps,
  type MapMomentStageProps,
  type MapMomentCamera,
  type MomentCandidate,
  type MomentFrame,
} from './MapMoment';
export {
  RecordNav,
  EmptyList,
  type RecordNavProps,
  type RecordNavTarget,
  type EmptyListProps,
} from './RoomFoot';
