/**
 * Entry point for scripts/notify-test.sh. Sends one alert, or with --all every template, to the
 * owner mailbox or the address given. Exits non-zero unless Resend accepted every email.
 */
import { sendNotification, type Notification } from '../src/lib/notify/notify';

const args = process.argv.slice(2);
const all = args.includes('--all');
const to = args.find((arg) => !arg.startsWith('--'))?.trim() || 'owner';
const run = Date.now();
const rc = 'BB-COR-0000TEST0000TEST';

const emails: Omit<Notification, 'to' | 'idempotencyKey'>[] = all
  ? [
      { event: 'correction.received', data: { receiptCode: rc } },
      { event: 'appeal.received', data: { receiptCode: rc } },
      {
        event: 'correction.closed',
        data: { receiptCode: rc, outcome: 'resolved', appealAvailable: false },
      },
      {
        event: 'correction.closed',
        data: { receiptCode: rc, outcome: 'rejected', appealAvailable: true },
      },
      {
        event: 'correction.closed',
        data: { receiptCode: rc, outcome: 'rejected', appealAvailable: false },
      },
      {
        event: 'owner.new_submission',
        data: {
          kind: 'test',
          headline: 'Factual error in a published record on “Sample record”',
          statement: 'Sample of what a submitter wrote, shown to the owner as a quote.',
          id: 'notify-test',
        },
      },
    ]
  : [
      {
        event: 'owner.new_submission',
        data: { kind: 'test', headline: 'Intake email wiring test', id: 'notify-test' },
      },
    ];

let ok = true;
for (const [i, email] of emails.entries()) {
  // A fresh key per run, so a rerun sends again instead of being deduplicated.
  const result = await sendNotification({
    ...email,
    to,
    idempotencyKey: `notify-test:${run}:${i}`,
  } as Notification);
  ok &&= result.status === 'sent';
  const note = 'id' in result ? result.id : 'reason' in result ? result.reason : result.detail;
  console.log(`notify-test: ${email.event} ${result.status}`, note);
}
process.exit(ok ? 0 : 1);
