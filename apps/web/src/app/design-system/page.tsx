/**
 * `/design-system`: the kit's gallery, for staff. Everything on it is generated from what
 * `@repo/ui` exports (see `Gallery.tsx`), so it cannot describe a component the kit has dropped
 * or miss one it has added.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@repo/ui';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { PageFrame } from '../../components/page';
import { Gallery } from './Gallery';
import '../utility.css';
import './gallery.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/design-system',
  title: 'Design system',
  description: 'Every component and token the kit exports, in both themes.',
});

export const dynamic = 'force-dynamic';

export default async function DesignSystemPage() {
  if (!(await readVerifiedAdminIdentity())) redirect('/admin/login?next=%2Fdesign-system');
  return (
    <PageFrame width="wide">
      <PageHeader
        title="Design system"
        dek="Every component and token the kit exports. The rules are in docs/ui/DESIGN.md."
      />
      <Gallery />
    </PageFrame>
  );
}
