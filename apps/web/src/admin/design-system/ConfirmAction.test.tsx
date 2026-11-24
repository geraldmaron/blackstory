import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
void React;
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmAction, confirmActionCopy, confirmActionHandlers } from './ConfirmAction';

test('the title names the action and the object; the confirm button repeats the verb', () => {
  assert.deepEqual(
    confirmActionCopy({ verb: 'Reject', noun: 'submission', name: 'Greenwood correction' }),
    { title: 'Reject “Greenwood correction”?', confirmLabel: 'Reject submission' },
  );
  assert.deepEqual(
    confirmActionCopy({ verb: 'Mark', tail: 'as spam', noun: 'submission', name: 'Buy now' }),
    { title: 'Mark “Buy now” as spam?', confirmLabel: 'Mark submission as spam' },
  );
});

test('a bulk action shows its count in both the title and the confirm button', () => {
  assert.deepEqual(confirmActionCopy({ verb: 'Merge', noun: 'case', count: 12 }), {
    title: 'Merge 12 cases?',
    confirmLabel: 'Merge 12 cases',
  });
  // One object with no name still reads as a sentence.
  assert.equal(confirmActionCopy({ verb: 'Merge', noun: 'case' }).title, 'Merge case?');
});

test('cancel dismisses without running the action; confirm dismisses, then runs it once', () => {
  const calls: string[] = [];
  const handlers = confirmActionHandlers({ onConfirm: () => calls.push('confirm') }, () =>
    calls.push('dismiss'),
  );
  handlers.cancel();
  assert.deepEqual(calls, ['dismiss']);
  handlers.confirm();
  assert.deepEqual(calls, ['dismiss', 'dismiss', 'confirm']);
});

test('renders the consequence with Cancel ahead of the verb button, and nothing when idle', () => {
  assert.equal(renderToStaticMarkup(<ConfirmAction request={null} onDismiss={() => {}} />), '');
  const markup = renderToStaticMarkup(
    <ConfirmAction
      request={{
        verb: 'Reject',
        noun: 'submission',
        name: 'Greenwood correction',
        consequence: 'You can’t reopen a rejected submission.',
        onConfirm: () => {},
      }}
      onDismiss={() => {}}
    />,
  );
  assert.match(markup, /<h2[^>]*>Reject “Greenwood correction”\?<\/h2>/);
  assert.match(markup, /You can’t reopen a rejected submission\./);
  assert.match(markup, /type="button"[^>]*>Cancel<\/button><button[^>]*>Reject submission</);
  assert.doesNotMatch(markup, />(OK|Confirm)</);
});
