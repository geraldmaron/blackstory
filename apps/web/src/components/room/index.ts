/**
 * The v9 room kit — the shared surface vocabulary for Reading, Record and Utility rooms.
 *
 * Design law: docs/ui/design-direction-v9-surfaces.md §2 and §4. Every room imports from here
 * and from exactly one of `reading-room.css`, `record-page.css` or `utility.css`. Nothing
 * under `apps/web/src/app` may add another `*-edition.css` or `*-panel-chrome.ts`; the guard
 * lives in `room-kit.test.tsx`.
 */

export { Room, type RoomProps } from './Room';
export { RoomHeader, type RoomHeaderProps } from './RoomHeader';
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
export { Prose, RecordRef, type ProseProps, type RecordRefProps } from './Prose';
export {
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
  UtilityCard,
  UtilityStep,
  type DisclosureProps,
  type FieldProps,
  type UtilityCardProps,
  type UtilityStepProps,
} from './Utility';
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
