/**
 * Layout size primitive. `./testing` is deliberately not re-exported here — it is test-only
 * and app code should never reach it; import it as `@/ui/layout/testing` from a test file.
 */
export {
  classifyLayoutSize,
  layoutHeightBreakpoints,
  layoutWidthBreakpoints,
  useLayoutSize,
  type LayoutOrientation,
  type LayoutSize,
  type LayoutSizeClass,
  type LayoutWindow,
} from './layout-size';
