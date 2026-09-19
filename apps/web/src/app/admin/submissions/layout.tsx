/**
 * Protected layout for the raw submissions queue (submissions.intake_items).
 */
import type { ReactNode } from 'react';
import { RequireAdminAuth } from '../../../admin/components/RequireAdminAuth';

export default function SubmissionsLayout({ children }: { children: ReactNode }) {
  return <RequireAdminAuth>{children}</RequireAdminAuth>;
}
