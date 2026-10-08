import { WorkInbox } from '../../../../admin/work/work-inbox';
export const metadata = { title: 'Review request' };
export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  return <WorkInbox workId={(await params).id} />;
}
