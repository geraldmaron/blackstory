import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recipientFrom, renderNotification, sendNotification, type Notification } from './notify';

const received: Notification = {
  event: 'correction.received',
  to: 'reader@example.org',
  data: { receiptCode: 'BS-ABCD-EFGH' },
  idempotencyKey: 'correction.received:1',
};

test('every template renders a subject and a body carrying its link', () => {
  const { subject, text } = renderNotification(received);
  assert.match(subject, /BS-ABCD-EFGH/);
  assert.match(text, /\/corrections\/status\/BS-ABCD-EFGH/);
  const closed = renderNotification({
    event: 'correction.closed',
    to: 'x@example.org',
    data: { receiptCode: 'C', outcome: 'rejected' },
    idempotencyKey: 'k',
  });
  assert.match(closed.text, /appeal/);
});

test('without mail configured, nothing is fetched and the send is skipped', async () => {
  let called = false;
  const result = await sendNotification(received, {}, (async () => {
    called = true;
    return new Response('{}');
  }) as typeof fetch);
  assert.deepEqual(result, { status: 'skipped', reason: 'not_configured' });
  assert.equal(called, false);
});

test('a configured send posts to Resend with the idempotency key; owner resolves to the mailbox', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const env = {
    RESEND_API_KEY: 'test-key',
    NOTIFY_FROM_EMAIL: 'BlackStory <a@b.org>',
    NOTIFY_OWNER_EMAIL: 'owner@b.org',
  };
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
  }) as unknown as typeof fetch;
  assert.deepEqual(await sendNotification(received, env, fake), { status: 'sent', id: 'email-1' });
  const owner = await sendNotification(
    {
      event: 'owner.new_submission',
      to: 'owner',
      data: { kind: 'lead', summary: 's', id: 'i' },
      idempotencyKey: 'o',
    },
    env,
    fake,
  );
  assert.equal(owner.status, 'sent');
  assert.equal(calls[0]?.url, 'https://api.resend.com/emails');
  assert.equal(
    (calls[0]?.init.headers as Record<string, string>)['idempotency-key'],
    'correction.received:1',
  );
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)).to, ['owner@b.org']);
});

test('a provider error or network failure is reported, never thrown', async () => {
  const env = { RESEND_API_KEY: 'k', NOTIFY_FROM_EMAIL: 'a@b.org' };
  const bad = (async () => new Response('nope', { status: 422 })) as unknown as typeof fetch;
  assert.equal((await sendNotification(received, env, bad)).status, 'failed');
  const down = (async () => {
    throw new Error('ECONNRESET');
  }) as unknown as typeof fetch;
  assert.equal((await sendNotification(received, env, down)).status, 'failed');
});

test('only a plausible address is mailed', () => {
  assert.equal(recipientFrom(' reader@example.org '), 'reader@example.org');
  assert.equal(recipientFrom('call me'), undefined);
  assert.equal(recipientFrom(undefined), undefined);
});
