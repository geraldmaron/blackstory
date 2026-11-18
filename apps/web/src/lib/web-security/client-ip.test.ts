import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientIpFrom } from './client-ip';

const request = (url: string, headers: Record<string, string>) => new Request(url, { headers });

test('uses the Cloudflare reader IP on the Cloudflare hostname', () => {
  const ip = clientIpFrom(
    request('https://blackstory.app/corrections/api', {
      'cf-connecting-ip': '203.0.113.7',
      'x-forwarded-for': '172.70.1.1',
    }),
  );
  assert.equal(ip, '203.0.113.7');
});

test('ignores cf-connecting-ip on hosts that skip Cloudflare', () => {
  const ip = clientIpFrom(
    request('https://blackstory-admin.vercel.app/corrections/api', {
      'cf-connecting-ip': '203.0.113.7',
      'x-forwarded-for': '198.51.100.2, 10.0.0.1',
    }),
  );
  assert.equal(ip, '198.51.100.2');
});

test('falls back to x-forwarded-for, and to undefined when neither is set', () => {
  assert.equal(
    clientIpFrom(request('https://blackstory.app/x', { 'x-forwarded-for': '198.51.100.2' })),
    '198.51.100.2',
  );
  assert.equal(clientIpFrom(request('https://blackstory.app/x', {})), undefined);
});
