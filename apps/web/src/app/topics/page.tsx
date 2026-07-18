/**
 * Legacy Topics route — permanently redirects to the Stories article library.
 */
import { permanentRedirect } from 'next/navigation';

export default function TopicsRedirectPage() {
  permanentRedirect('/stories');
}
