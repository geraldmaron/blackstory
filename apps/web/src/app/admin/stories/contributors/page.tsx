import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listContributors } from '@/admin/editorial/store';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import { Contributors } from '@/admin/editorial/contributors';
import { DeskTitleBar } from '@/admin/design-system/ui';
import '../stories.css';
import './contributors.css';
export default async function ContributorPage() {
  const identity = await readVerifiedAdminIdentity();
  if (!identity) redirect('/admin/login');
  return (
    <main id="main" className="editorial-workspace ds-container">
      <DeskTitleBar
        title="People & bylines"
        description="Public credits are separate from staff permissions and private account details."
      />
      <Link href="/admin/stories">Stories</Link>
      <Contributors profiles={await listContributors(identity.uid)} />
    </main>
  );
}
