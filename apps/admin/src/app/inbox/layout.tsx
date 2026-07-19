/**
 * Auth gate for inbox.
 */
import type { ReactNode } from 'react';
import { RequireAdminAuth } from '../../components/RequireAdminAuth';

export default function InboxLayout({ children }: { children: ReactNode }) {
  return <RequireAdminAuth>{children}</RequireAdminAuth>;
}
