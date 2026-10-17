import { StoryList } from '@/admin/editorial/story-list';
import { redirect } from 'next/navigation';
import { listStories } from '@/admin/editorial/store';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import './stories.css';
export default async function StoriesPage() {
  if (!(await readVerifiedAdminIdentity())) redirect('/admin/login');
  const items = await listStories();
  return <StoryList items={items} />;
}
