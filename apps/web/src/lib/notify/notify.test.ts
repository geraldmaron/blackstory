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
    data: { receiptCode: 'C', outcome: 'rejected', appealAvailable: true },
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
      data: { kind: 'lead', headline: 's', id: 'i' },
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

const EVERY_EMAIL: Notification[] = [
  received,
  {
    event: 'appeal.received',
    to: 'x@example.org',
    data: { receiptCode: 'C' },
    idempotencyKey: 'k',
  },
  ...(['resolved', 'rejected'] as const).flatMap((outcome) =>
    [true, false].map((appealAvailable): Notification => ({
      event: 'correction.closed',
      to: 'x@example.org',
      data: { receiptCode: 'C', outcome, appealAvailable },
      idempotencyKey: 'k',
    })),
  ),
  {
    event: 'owner.new_submission',
    to: 'owner',
    data: { kind: 'correction', headline: 'h', statement: 's', id: 'i' },
    idempotencyKey: 'k',
  },
];

test('every email keeps the house voice and carries the brand layout', () => {
  for (const n of EVERY_EMAIL) {
    const { subject, text, html } = renderNotification(n);
    const words = `${subject}\n${text}`;
    assert.doesNotMatch(words, /\bwe\b|\bour\b|\bus\b/iu, `${n.event} speaks as "we"`);
    assert.doesNotMatch(words, /!/u, `${n.event} uses an exclamation mark`);
    assert.doesNotMatch(
      words,
      /quarantin|promot|queue|graylist/iu,
      `${n.event} leaks pipeline words`,
    );
    assert.match(html, /email-lockup\.png/u);
    assert.match(html, /#B86B2A/u);
  }
});

test('a declined correction offers an appeal only while one is left', () => {
  const closed = (appealAvailable: boolean) =>
    renderNotification({
      event: 'correction.closed',
      to: 'x@example.org',
      data: { receiptCode: 'C', outcome: 'rejected', appealAvailable },
      idempotencyKey: 'k',
    }).text;
  assert.match(closed(true), /appeal once/u);
  assert.doesNotMatch(closed(false), /appeal once/u);
  assert.match(closed(false), /final outcome/u);
});

test('submitter text is escaped in the HTML', () => {
  const { html } = renderNotification({
    event: 'owner.new_submission',
    to: 'owner',
    data: { kind: 'lead', headline: '<b>x</b>', statement: '<script>alert(1)</script>', id: 'i' },
    idempotencyKey: 'k',
  });
  assert.doesNotMatch(html, /<script>|<b>x/u);
  assert.match(html, /&lt;script&gt;/u);
});

test('a decline with a reason quotes it right under the line that introduces it', () => {
  const { text } = renderNotification({
    event: 'correction.closed',
    to: 'x@example.org',
    data: {
      receiptCode: 'C',
      outcome: 'rejected',
      appealAvailable: true,
      reason: 'The ledger says 1926.',
    },
    idempotencyKey: 'k',
  });
  assert.match(text, /Here’s why\.\n\n> The ledger says 1926\.\n\nIf you think/u);
});
