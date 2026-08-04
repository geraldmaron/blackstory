/**
 * Server gate: requires a verified Supabase staff session; otherwise redirects to /login.
 *
 * Runs on the server and redirects before `children` render, so a page's server-side data
 * reads never execute for an unauthorized caller and nothing reaches the RSC payload.
 * Middleware already blocks these routes at the edge — this is the second layer, so a
 * matcher mistake cannot silently expose a surface.
 */
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { readVerifiedAdminIdentity } from '../auth/supabase-server';

export async function RequireAdminAuth({
  children,
}: {
  readonly children: ReactNode;
}): Promise<ReactNode> {
  const identity = await readVerifiedAdminIdentity();
  if (!identity) {
    redirect('/login');
  }
  return <>{children}</>;
}
