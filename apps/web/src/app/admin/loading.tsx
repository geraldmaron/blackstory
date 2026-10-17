import { PageSkeleton } from '../../admin/design-system/ui';

/**
 * Shown the moment a sidebar link is clicked, while the server renders the next desk. Without it
 * the page froze on the old content for the whole server render (0.4 to 0.6 s warm, several
 * seconds cold), which reads as a hang.
 */
export default function AdminLoading() {
  return <PageSkeleton />;
}
