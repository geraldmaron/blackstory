import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listContributors } from '@/admin/editorial/store';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import { Contributors } from '@/admin/editorial/contributors';
import '../articles/articles.css';
export default async function ContributorPage() {
  if (!(await readVerifiedAdminIdentity())) redirect('/admin/login');
  return (
    <main id="main" className="editorial-workspace ds-container">
      <h1>Contributors</h1>
      <p>Public credits are separate from staff permissions and private account details.</p>
      <Link href="/admin/stories/articles">Articles</Link>
      <Contributors profiles={await listContributors()} />
    </main>
  );
}
