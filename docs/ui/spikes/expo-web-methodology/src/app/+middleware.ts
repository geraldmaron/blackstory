import { setResponseHeaders } from 'expo-server';

export default function middleware(request: Request) {
  setResponseHeaders({
    'Content-Security-Policy':
      "script-src 'self' 'sha256-67fhrP0+BkBqmgGGXTtgiVO/9EQs3QruYNU/7fnRkI8='; object-src 'none'; base-uri 'none'",
    'Cache-Control': 'public, s-maxage=3600',
  });
}
