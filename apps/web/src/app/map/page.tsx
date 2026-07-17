/**
 * map data platform route redirects to production `/explore` experience now that
 * the national map is live. The demo style builder and fixture GeoJSON remain in this
 * directory for tests and the explore canvas wiring.
 */
import { redirect } from 'next/navigation';

export default function MapPage() {
  redirect('/explore');
}
