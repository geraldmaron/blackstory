/**
 * Hidden route (see (tabs)/_layout.tsx's `href: null` on this screen). Exists only because Expo
 * Router's tab group needs an `index` to resolve a bare `/`; it immediately redirects to the
 * canonical `/explore` tab so the app never has a distinct, undocumented "home" URL.
 */
import { Redirect } from 'expo-router';

export default function TabIndexRedirect() {
  return <Redirect href="/explore" />;
}
