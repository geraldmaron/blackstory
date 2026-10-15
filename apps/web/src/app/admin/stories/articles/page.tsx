import { ArticleList } from '@/admin/editorial/article-list';
import { redirect } from 'next/navigation';
import { listArticles } from '@/admin/editorial/store';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import './articles.css';
export default async function ArticlesPage() {
  if (!(await readVerifiedAdminIdentity())) redirect('/admin/login');
  const items = await listArticles();
  return <ArticleList items={items} />;
}
