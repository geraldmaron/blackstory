import { setResponseHeaders } from 'expo-server';

export default function middleware(_request: Request) {
  setResponseHeaders({ 'Cache-Control': 'private, no-store' });
}
