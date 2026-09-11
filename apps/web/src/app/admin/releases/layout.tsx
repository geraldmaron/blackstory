/**
 * Protected layout for publication release inspection.
 */
import type { ReactNode } from 'react';
import { RequireAdminAuth } from '../../../admin/components/RequireAdminAuth';

export default function ReleasesLayout({ children }: { children: ReactNode }) {
  return <RequireAdminAuth>{children}</RequireAdminAuth>;
}
