/**
 * Outbound email for public intake: the receipt a corrector gets, the outcome when staff close
 * it, and the alert the owner gets when anything new lands in the queue.
 *
 * To add a notification: add a template to `TEMPLATES`, then call `notify()` where the event
 * happens. Nothing else changes. Sending goes through Resend's HTTP API with plain `fetch`, and is
 * off until `RESEND_API_KEY` and `NOTIFY_FROM_EMAIL` are set: without them every call is logged
 * and skipped, so intake never fails or slows down because mail is unconfigured or down.
 */
import { after } from 'next/server';
import { SUPPORT_CONTACT } from '../config/contact';
import { isEmail } from '../../components/forms/validators';

/** A submitter-typed contact, if it is an address mail can go to. Anything else is not mailed. */
export function recipientFrom(value: unknown): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed && isEmail(trimmed) ? trimmed : undefined;
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';
}

function statusLink(receiptCode: string): string {
  return `${siteOrigin()}/corrections/status/${encodeURIComponent(receiptCode)}`;
}

const SIGN_OFF = `\n\nGerald Dagher, BlackStory\nReply to this email if you have a question: ${SUPPORT_CONTACT}`;

type Template<Data> = (data: Data) => { readonly subject: string; readonly text: string };

const TEMPLATES = {
  'correction.received': (d: { receiptCode: string }) => ({
    subject: `Correction received: ${d.receiptCode}`,
    text:
      `Thanks for telling the archive it's wrong. A person will read your correction against the published sources, usually within ten working days.\n\n` +
      `Your receipt code is ${d.receiptCode}. Check the status any time:\n${statusLink(d.receiptCode)}\n\n` +
      `You'll get one more email when it's closed.${SIGN_OFF}`,
  }),
  'correction.closed': (d: { receiptCode: string; outcome: 'resolved' | 'rejected' }) => ({
    subject: `Correction ${d.receiptCode}: ${d.outcome === 'resolved' ? 'reviewed and closed' : 'declined'}`,
    text:
      (d.outcome === 'resolved'
        ? `Your correction has been reviewed and closed. Where the record changed, the change is listed in Errata with the earlier wording still readable:\n${siteOrigin()}/errata\n\n`
        : `Your correction was reviewed and the record was not changed. If you think the review missed something, you can appeal once from the status page.\n\n`) +
      `Status for ${d.receiptCode}:\n${statusLink(d.receiptCode)}${SIGN_OFF}`,
  }),
  'appeal.received': (d: { receiptCode: string }) => ({
    subject: `Appeal received: ${d.receiptCode}`,
    text: `Your appeal is back in review against the same receipt. You'll get an email when it's closed.\n\n${statusLink(d.receiptCode)}${SIGN_OFF}`,
  }),
  /** To the owner. Carries no submitter details: the admin queue is where those are read. */
  'owner.new_submission': (d: { kind: string; summary: string; id: string }) => ({
    subject: `New ${d.kind}: ${d.summary}`.slice(0, 140),
    text: `A new ${d.kind} is waiting in the review queue.\n\n${d.summary}\n\n${siteOrigin()}/admin/submissions/${d.id}`,
  }),
} satisfies Record<string, Template<never>>;

export type NotificationEvent = keyof typeof TEMPLATES;
export type NotificationData<E extends NotificationEvent> = Parameters<(typeof TEMPLATES)[E]>[0];

export type Notification = {
  [E in NotificationEvent]: {
    readonly event: E;
    /** Recipient address. `'owner'` sends to the published support mailbox. */
    readonly to: string | 'owner';
    readonly data: NotificationData<E>;
    /** Same key, same email: Resend drops the repeat for 24 hours. */
    readonly idempotencyKey: string;
  };
}[NotificationEvent];

export type SendResult =
  | { readonly status: 'sent'; readonly id: string }
  | { readonly status: 'skipped'; readonly reason: 'not_configured' | 'no_recipient' }
  | { readonly status: 'failed'; readonly detail: string };

export function renderNotification(n: Notification): { subject: string; text: string } {
  return (TEMPLATES[n.event] as Template<typeof n.data>)(n.data);
}

/** Sends one notification now. Never throws: mail is a courtesy, never a reason intake fails. */
export async function sendNotification(
  n: Notification,
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const to = n.to === 'owner' ? env.NOTIFY_OWNER_EMAIL?.trim() || SUPPORT_CONTACT : n.to.trim();
  if (!to) return { status: 'skipped', reason: 'no_recipient' };
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.NOTIFY_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    console.info('notify: skipped, mail not configured', { event: n.event });
    return { status: 'skipped', reason: 'not_configured' };
  }
  const { subject, text } = renderNotification(n);
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': n.idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], reply_to: SUPPORT_CONTACT, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = `${response.status} ${(await response.text()).slice(0, 300)}`;
      console.error('notify: send failed', { event: n.event, detail });
      return { status: 'failed', detail };
    }
    const body = (await response.json()) as { id?: string };
    return { status: 'sent', id: body.id ?? '' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('notify: send failed', { event: n.event, detail });
    return { status: 'failed', detail };
  }
}

/**
 * Sends after the response has gone out, so a slow mail API never delays the submitter. Outside
 * a request (scripts, tests) `after` throws, and the send just runs in the background instead.
 */
export function notify(n: Notification): void {
  const task = () => sendNotification(n).then(() => undefined);
  try {
    after(task);
  } catch {
    void task();
  }
}

export type Notifier = (n: Notification) => void;
