/**
 * The page kit: the frame, section, contents list and prose every reading, record and utility page
 * shares (docs/ui/DESIGN.md section 9.6). A page imports from here and from one of
 * `reading-page.css`, `record-page.css` or `utility.css`.
 */

export { PageFrame, type PageFrameProps, type PageWidth } from './PageFrame';
export { parentCrumb, resolveTrail, type Crumb } from './crumb-trail';
export {
  PageSection,
  FactList,
  RelatedLink,
  type PageSectionProps,
  type PageFact,
  type RelatedLinkProps,
} from './PageSection';
export { ContentsList, type ContentsListProps, type ContentsEntry } from './ContentsList';
export { Prose, type ProseProps } from './Prose';
export { ArchiveFigure } from './ArchiveFigure';
