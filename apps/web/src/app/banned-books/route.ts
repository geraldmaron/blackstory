/**
 * `/about` names this room Banned books. The catalogue lives at `/books`.
 */
import { NextResponse } from 'next/server';

export function GET(request: Request) {
  return NextResponse.redirect(new URL('/books', request.url), 308);
}
