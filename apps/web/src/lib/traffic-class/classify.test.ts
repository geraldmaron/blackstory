/**
 * Traffic-class classifier: named crawlers, tools, automation signals, and
 * the guarantee that the analytics payload is an enum only.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AI_TRAINING_USER_AGENTS } from './agent-lists';
import {
  buildTrafficEventPayload,
  classifyTraffic,
  TRAFFIC_CLASSES,
  TRAFFIC_EVENT_NAME,
} from './classify';

const CHROME_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

test('empty user agent is a tool, not a person', () => {
  assert.equal(classifyTraffic({ userAgent: '' }), 'tool');
  assert.equal(classifyTraffic({ userAgent: '   ' }), 'tool');
});

test('AI-training agents win over overlapping search stems', () => {
  assert.equal(
    classifyTraffic({
      userAgent: 'Mozilla/5.0 (compatible; Applebot-Extended/0.1; +https://www.apple.com/bot)',
    }),
    'ai_crawler',
  );
  assert.equal(
    classifyTraffic({
      userAgent: 'Mozilla/5.0 (compatible; Google-Extended/1.0; +https://www.google.com/bot.html)',
    }),
    'ai_crawler',
  );
  assert.equal(classifyTraffic({ userAgent: 'GPTBot/1.0' }), 'ai_crawler');
});

test('every robots AI token classifies as ai_crawler', () => {
  for (const token of AI_TRAINING_USER_AGENTS) {
    assert.equal(classifyTraffic({ userAgent: `Mozilla/5.0 ${token}/1.0` }), 'ai_crawler', token);
  }
});

test('search crawlers that we allow to index', () => {
  assert.equal(
    classifyTraffic({
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    }),
    'search_crawler',
  );
  assert.equal(
    classifyTraffic({
      userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    }),
    'search_crawler',
  );
  assert.equal(
    classifyTraffic({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Applebot/0.1',
    }),
    'search_crawler',
  );
});

test('scripted clients are tools', () => {
  assert.equal(classifyTraffic({ userAgent: 'curl/8.7.1' }), 'tool');
  assert.equal(classifyTraffic({ userAgent: 'python-requests/2.32.3' }), 'tool');
  assert.equal(classifyTraffic({ userAgent: 'Go-http-client/2.0' }), 'tool');
});

test('Java/ matches a client and not a browser UA that contains javascript', () => {
  assert.equal(classifyTraffic({ userAgent: 'Java/17.0.1' }), 'tool');
  assert.equal(
    classifyTraffic({
      userAgent: `${CHROME_DESKTOP} javascript`,
      languages: ['en-US'],
    }),
    'likely_human',
  );
});

test('headless and webdriver signals are automated', () => {
  assert.equal(
    classifyTraffic({
      userAgent: `${CHROME_DESKTOP} HeadlessChrome/128.0.0.0`,
    }),
    'automated',
  );
  assert.equal(
    classifyTraffic({ userAgent: CHROME_DESKTOP, webdriver: true, languages: ['en-US'] }),
    'automated',
  );
  assert.equal(classifyTraffic({ userAgent: CHROME_DESKTOP, languages: [] }), 'automated');
  assert.equal(classifyTraffic({ userAgent: CHROME_DESKTOP, acceptLanguage: '' }), 'automated');
});

test('an ordinary desktop browser with languages is likely_human', () => {
  assert.equal(
    classifyTraffic({ userAgent: CHROME_DESKTOP, languages: ['en-US', 'en'] }),
    'likely_human',
  );
});

test('missing languages is not enough to call a browser automated', () => {
  assert.equal(classifyTraffic({ userAgent: CHROME_DESKTOP }), 'likely_human');
});

test('the analytics payload is the enum only', () => {
  const payload = buildTrafficEventPayload('likely_human');
  assert.deepEqual(payload, { class: 'likely_human' });
  assert.deepEqual(Object.keys(payload), ['class']);
  assert.ok(TRAFFIC_CLASSES.includes(payload.class));
  assert.equal(TRAFFIC_EVENT_NAME, 'traffic');
});
