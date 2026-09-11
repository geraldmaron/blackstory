/**
 * Protected layout for story review and other signed-in admin surfaces.
 */
import type { ReactNode } from 'react';
import { RequireAdminAuth } from '../../../admin/components/RequireAdminAuth';

export default function StoriesLayout({ children }: { children: ReactNode }) {
  return <RequireAdminAuth>{children}</RequireAdminAuth>;
}
