import assert from 'node:assert/strict';
import test from 'node:test';
import { handleManagementMcp } from './management.js';

test('stateless remote MCP lists tools and passes the exact decision to the shared service', async () => {
  const calls: { path: string; body: unknown }[] = [];
  const call = async (method: string, params: unknown) => {
    const response = await handleManagementMcp(
      new Request('https://blackstory.app/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      }),
      async (path, body) => {
        calls.push({ path, body });
        return { saved: true };
      },
    );
    assert.equal(response.status, 200);
    return await response.json();
  };
  const list = await call('tools/list', {});
  assert.deepEqual(
    list.result.tools.map((tool: { name: string }) => tool.name),
    [
      'source_library',
      'request_work',
      'research_work',
      'list_work',
      'get_work',
      'decide_work',
      'retry_work',
    ],
  );
  const workId = '11111111-1111-4111-8111-111111111111';
  const body = {
    version: 2,
    proposalHash: 'a'.repeat(64),
    entityIds: ['lincoln'],
    action: 'approve',
    reason: 'Publish these',
    sessionId: 'phone-session',
    idempotencyKey: 'decision-1',
  };
  const approved = await call('tools/call', {
    name: 'decide_work',
    arguments: { workId, ...body },
  });
  assert.equal(approved.result.isError, undefined);
  assert.deepEqual(calls, [{ path: `/${workId}/decisions`, body }]);
  const invalid = await call('tools/call', {
    name: 'decide_work',
    arguments: { workId, ...body, proposalHash: 'old' },
  });
  assert.equal(invalid.result.isError, true);
  assert.equal(calls.length, 1);
  const research = await call('tools/call', {
    name: 'research_work',
    arguments: { workId, action: 'start', sessionId: 'another-harness' },
  });
  assert.equal(research.result.isError, undefined);
  assert.deepEqual(calls[1], {
    path: `/${workId}/research`,
    body: { action: 'start', sessionId: 'another-harness' },
  });
  const library = await call('tools/call', {
    name: 'source_library',
    arguments: { question: 'school buildings', assertionClass: 'chronology', offset: 20 },
  });
  assert.equal(library.result.isError, undefined);
  assert.deepEqual(calls[2], {
    path: '/source-library?question=school+buildings&assertionClass=chronology&offset=20',
    body: undefined,
  });
});
