/**
 * Static not-found page for the docs site export.
 */
import Link from 'next/link';

export default function NotFound() {
  return (
    <article className="prose">
      <h1>Page not found</h1>
      <p>That docs path is not in the curated public set.</p>
      <p>
        <Link href="/">Return home</Link>
      </p>
    </article>
  );
}
