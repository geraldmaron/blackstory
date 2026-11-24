/**
 * The opening's picks and sentences are the web's, and the town field keeps nothing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as webCopy from '../../../../web/src/app/front/retelling-copy';
import { OPENING_PROVISIONAL, OPENING_SCENES, OPENING_TAGLINE } from './opening-scenes';
import { lookUpTown, normalizeTown, TOWN_RESULT_LIMIT, type TownTransport } from './town-lookup';

const WEB_FRONT = join(__dirname, '../../../../web/src/app/front');

describe('opening scenes', () => {
  it('are the six words, in order', () => {
    expect(OPENING_SCENES.map((scene) => scene.heading)).toEqual([
      'History',
      'His story',
      'Her story',
      'Your story',
      'Their story',
      'BlackStory',
    ]);
    for (const scene of OPENING_SCENES) expect(scene.heading.startsWith(scene.prefix)).toBe(true);
  });

  it('carry the web’s sentences and tagline, and stay marked provisional while the web’s are', () => {
    expect(OPENING_PROVISIONAL).toBe(webCopy.RETELLING_COPY_PROVISIONAL);
    expect(OPENING_TAGLINE).toBe(webCopy.RETELLING_TAGLINE);
    for (const scene of OPENING_SCENES) {
      expect(scene.sentence).toBe(
        (webCopy.RETELLING_SENTENCES as Record<string, string | undefined>)[scene.id],
      );
    }
  });

  it('show the web’s three record picks', () => {
    const picks = readFileSync(join(WEB_FRONT, 'retelling-picks.ts'), 'utf8');
    const records = OPENING_SCENES.filter((scene) => scene.kind === 'record');
    expect(records).toHaveLength(3);
    for (const scene of records) {
      expect(picks).toContain(
        `'${scene.id}': { recordId: '${scene.recordId}', provisional: true }`,
      );
    }
  });

  it('say only what a word means: no person, year or count, no dash, no colon', () => {
    for (const { sentence } of OPENING_SCENES) {
      if (!sentence) continue;
      expect(sentence).not.toMatch(/\d|[—–:!?]/);
    }
  });
});

describe('town lookup', () => {
  const result = (names: readonly string[]) => ({
    kind: 'ok' as const,
    data: { results: names.map((name, index) => ({ id: `r${index}`, displayName: name })) },
  });

  it('sends what was typed once, to the app’s own search, and nowhere else', async () => {
    const paths: string[] = [];
    const transport = {
      readJson: async (path: string) => {
        paths.push(path);
        return result(['Tuskegee Institute']);
      },
    } as unknown as TownTransport;
    const answer = await lookUpTown(transport, 'Tuskegee');
    expect(paths).toEqual([`/v1/search?q=Tuskegee&pageSize=${TOWN_RESULT_LIMIT}`]);
    expect(answer).toEqual({ kind: 'found', records: [{ id: 'r0', name: 'Tuskegee Institute' }] });
  });

  it('shows at most three records', async () => {
    const transport = {
      readJson: async () => result(['a', 'b', 'c', 'd', 'e']),
    } as unknown as TownTransport;
    const answer = await lookUpTown(transport, 'Somewhere');
    expect(answer.kind === 'found' && answer.records).toHaveLength(3);
  });

  it('says none plainly, and failed when the archive does not answer', async () => {
    const none = { readJson: async () => result([]) } as unknown as TownTransport;
    expect(await lookUpTown(none, 'Nowhere')).toEqual({ kind: 'none' });
    const down = {
      readJson: async () => {
        throw new Error('offline');
      },
    } as unknown as TownTransport;
    expect(await lookUpTown(down, 'Nowhere')).toEqual({ kind: 'failed' });
  });

  it('bounds what was typed and refuses an empty town', () => {
    expect(normalizeTown('  Auburn,   New York ')).toBe('Auburn, New York');
    expect(normalizeTown(' a ')).toBeNull();
    expect(normalizeTown('x'.repeat(500))).toHaveLength(80);
  });

  it('touches no storage, recent searches, cache or location', () => {
    for (const file of ['town-lookup.ts', 'OpeningScreen.tsx']) {
      const source = readFileSync(join(__dirname, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(source).not.toMatch(
        /recentSearches|recent-searches|SecureStore|setMeta|releaseCache|expo-location|geolocation|markPerf/,
      );
    }
  });
});
