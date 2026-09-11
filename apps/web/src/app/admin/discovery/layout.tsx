/**
 * Auth gate for discovery ops.
 */
import type { ReactNode } from 'react';
import { RequireAdminAuth } from '../../../admin/components/RequireAdminAuth';

export default function DiscoveryLayout({ children }: { children: ReactNode }) {
  return <RequireAdminAuth>{children}</RequireAdminAuth>;
}
