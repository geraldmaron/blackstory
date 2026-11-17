/** Entry point for scripts/notify-test.sh. Exits non-zero unless Resend accepted the email. */
import { sendNotification } from '../src/lib/notify/notify';

const to = process.argv[2]?.trim() || 'owner';
const result = await sendNotification({
  event: 'owner.new_submission',
  to,
  data: { kind: 'test', summary: 'Intake email wiring test', id: 'notify-test' },
  // A fresh key per run, so a rerun sends again instead of being deduplicated.
  idempotencyKey: `notify-test:${Date.now()}`,
});
console.log(
  `notify-test: ${result.status}`,
  'id' in result ? result.id : 'reason' in result ? result.reason : result.detail,
);
process.exit(result.status === 'sent' ? 0 : 1);
