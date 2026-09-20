/**
 * The v9 room kit — the shared surface vocabulary for Reading, Record and Utility rooms.
 *
 * Design law: docs/ui/design-direction-v9-surfaces.md §2 and §4. Every room imports from here
 * and from exactly one of `reading-room.css`, `record-page.css` or `utility.css`. Nothing
 * under `apps/web/src/app` may add another `*-edition.css` or `*-panel-chrome.ts`; the guard
 * lives in `room-kit.test.tsx`.
 */

export { Room, type RoomProps } from './Room';
export {
  ReadingEntry,
  DocumentColophon,
  OrientationInstrument,
  type EntryPosture,
  type ReadingEntryProps,
  type DocumentColophonProps,
  type OrientationInstrumentProps,
  type OrientationMove,
} from './EntryPosture';
export { RailGroup, type RailGroupProps, type RailEntry } from './RoomRail';
export { Breadcrumb, type BreadcrumbProps } from './Breadcrumb';
export { resolveTrail, roomLabelFor, type RoomCrumb } from './room-trail';
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
  roomSectionTone,
  type RoomSectionProps,
  type RoomSectionTone,
  type RoomFact,
  type RoomHandoffProps,
} from './RoomSection';
export { DocumentPlate, type DocumentPlateProps } from './DocumentPlate';
export { KeepGoing, type KeepGoingProps } from './KeepGoing';
export { RoomStats, type RoomStatsProps, type RoomStat } from './RoomStats';
export { RoomJump, type RoomJumpProps, type RoomJumpSection } from './RoomJump';
export {
  FindBar,
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
  Note,
  type RoomSource,
  type SourceListProps,
  type RoomConnection,
  type ConnectionsProps,
  type TrustFact,
  type TrustBlockProps,
  type AnatomyCell,
  type AnatomyProps,
  type PrecisionProps,
  type NoteProps,
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
  OffRamp,
  RecordNav,
  EmptyList,
  type OffRampProps,
  type OffRampAction,
  type RecordNavProps,
  type RecordNavTarget,
  type EmptyListProps,
} from './RoomFoot';
