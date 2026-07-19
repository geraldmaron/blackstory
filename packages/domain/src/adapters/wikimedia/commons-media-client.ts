/**
 * Live Wikimedia API client for Commons media enrichment.
 * Batches wbgetentities / imageinfo; never downloads image bytes.
 */
import {
  chunkForWikimediaBatch,
  commonsFilePageUrl,
  type CommonsImageMetadata,
} from './commons-media.js';
import type { WikidataEntity } from './types.js';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

/** Wikimedia requires a descriptive User-Agent identifying the tool and contact. */
export const WIKIMEDIA_USER_AGENT =
  'BlackStoryCommonsEnrichment/1.0 (https://blackstory.app; research-dry-run; mailto:ops@blackstory.app)';

export type WikimediaHttpFetch = (
  url: string,
  init?: { readonly headers?: Readonly<Record<string, string>> },
) => Promise<{ readonly ok: boolean; readonly status: number; readonly json: () => Promise<unknown> }>;

export type EnwikiTitleResolveResult = {
  readonly title: string;
  readonly wikidataId?: string;
  readonly label?: string;
  readonly missing?: boolean;
};

export type FetchCommonsMediaClientOptions = {
  readonly fetchImpl?: WikimediaHttpFetch;
  readonly batchSize?: number;
  /** Delay between batches (ms) to stay polite. */
  readonly batchDelayMs?: number;
  readonly userAgent?: string;
};

function defaultFetch(): WikimediaHttpFetch {
  return async (url, init) => {
    const response = await fetch(
      url,
      init?.headers ? { headers: { ...init.headers } } : {},
    );
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.json(),
    };
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createCommonsMediaClient(options: FetchCommonsMediaClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? defaultFetch();
  const batchSize = options.batchSize ?? 50;
  const batchDelayMs = options.batchDelayMs ?? 200;
  const userAgent = options.userAgent ?? WIKIMEDIA_USER_AGENT;

  async function getJson(url: string): Promise<unknown> {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Wikimedia HTTP ${response.status} for ${url}`);
    }
    return response.json();
  }

  /**
   * Resolve English Wikipedia titles → Wikidata QIDs in batches of ≤50.
   * Uses wbgetentities sites=enwiki&titles=…
   */
  async function resolveEnwikiTitles(
    titles: readonly string[],
  ): Promise<readonly EnwikiTitleResolveResult[]> {
    const results: EnwikiTitleResolveResult[] = [];
    const batches = chunkForWikimediaBatch(titles, batchSize);
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i]!;
      const params = new URLSearchParams({
        action: 'wbgetentities',
        sites: 'enwiki',
        titles: batch.join('|'),
        props: 'labels|sitelinks',
        languages: 'en',
        format: 'json',
        origin: '*',
      });
      const raw = (await getJson(`${WIKIDATA_API}?${params.toString()}`)) as {
        readonly entities?: Readonly<
          Record<
            string,
            {
              readonly id?: string;
              readonly missing?: string;
              readonly labels?: Readonly<Record<string, { readonly value: string }>>;
              readonly sitelinks?: Readonly<Record<string, { readonly title: string }>>;
            }
          >
        >;
      };

      const byTitle = new Map<string, EnwikiTitleResolveResult>();
      const normalizeTitleKey = (value: string) => value.replace(/_/g, ' ').trim().toLowerCase();
      for (const entity of Object.values(raw.entities ?? {})) {
        const rawTitle = entity.sitelinks?.enwiki?.title;
        if (!rawTitle) {
          if (entity.missing !== undefined) continue;
          continue;
        }
        const title = rawTitle.replace(/_/g, ' ');
        byTitle.set(normalizeTitleKey(title), {
          title,
          ...(entity.id !== undefined && entity.missing === undefined
            ? { wikidataId: entity.id }
            : {}),
          ...(entity.labels?.en?.value !== undefined ? { label: entity.labels.en.value } : {}),
          ...(entity.missing !== undefined ? { missing: true } : {}),
        });
      }

      for (const requested of batch) {
        const hit = byTitle.get(normalizeTitleKey(requested));
        if (hit) {
          results.push(hit);
        } else {
          results.push({ title: requested, missing: true });
        }
      }

      if (i < batches.length - 1 && batchDelayMs > 0) {
        await sleep(batchDelayMs);
      }
    }
    return results;
  }

  /**
   * Fetch Wikidata entities (claims) by QID in batches of ≤50.
   */
  async function fetchEntitiesById(
    qids: readonly string[],
  ): Promise<ReadonlyMap<string, WikidataEntity>> {
    const map = new Map<string, WikidataEntity>();
    const unique = [...new Set(qids.filter((q) => /^Q\d+$/i.test(q)))];
    const batches = chunkForWikimediaBatch(unique, batchSize);
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i]!;
      const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: batch.join('|'),
        props: 'claims|labels',
        languages: 'en',
        format: 'json',
        origin: '*',
      });
      const raw = (await getJson(`${WIKIDATA_API}?${params.toString()}`)) as {
        readonly entities?: Readonly<Record<string, WikidataEntity & { readonly missing?: string }>>;
      };
      for (const [id, entity] of Object.entries(raw.entities ?? {})) {
        if (entity.missing !== undefined) continue;
        map.set(id, entity);
      }
      if (i < batches.length - 1 && batchDelayMs > 0) {
        await sleep(batchDelayMs);
      }
    }
    return map;
  }

  /**
   * Fetch Commons imageinfo + extmetadata for File: titles. Metadata only (no bytes).
   */
  async function fetchCommonsImageMetadata(
    fileTitles: readonly string[],
  ): Promise<ReadonlyMap<string, CommonsImageMetadata>> {
    const map = new Map<string, CommonsImageMetadata>();
    const normalized = fileTitles.map((t) => (t.startsWith('File:') ? t : `File:${t}`));
    const unique = [...new Set(normalized)];
    const batches = chunkForWikimediaBatch(unique, batchSize);
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i]!;
      const params = new URLSearchParams({
        action: 'query',
        titles: batch.join('|'),
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '800',
        format: 'json',
        origin: '*',
      });
      const raw = (await getJson(`${COMMONS_API}?${params.toString()}`)) as {
        readonly query?: {
          readonly pages?: Readonly<
            Record<
              string,
              {
                readonly title?: string;
                readonly missing?: string | boolean;
                readonly imageinfo?: readonly {
                  readonly url?: string;
                  readonly thumburl?: string;
                  readonly extmetadata?: Readonly<
                    Record<string, { readonly value?: string }>
                  >;
                }[];
              }
            >
          >;
        };
      };

      for (const page of Object.values(raw.query?.pages ?? {})) {
        if (!page.title || page.missing !== undefined) continue;
        const info = page.imageinfo?.[0];
        const meta = info?.extmetadata ?? {};
        const fileTitle = page.title.startsWith('File:') ? page.title : `File:${page.title}`;
        map.set(fileTitle, {
          fileTitle,
          commonsPageUrl: commonsFilePageUrl(fileTitle),
          ...(info?.thumburl !== undefined ? { thumbUrl: info.thumburl } : {}),
          ...(info?.url !== undefined ? { fullUrl: info.url } : {}),
          ...(meta.LicenseShortName?.value !== undefined
            ? { licenseShortName: meta.LicenseShortName.value }
            : {}),
          ...(meta.Artist?.value !== undefined ? { artist: meta.Artist.value } : {}),
          ...(meta.Credit?.value !== undefined ? { credit: meta.Credit.value } : {}),
          ...(meta.ImageDescription?.value !== undefined
            ? { imageDescription: meta.ImageDescription.value }
            : {}),
          ...(meta.AttributionRequired?.value !== undefined
            ? {
                attributionRequired:
                  String(meta.AttributionRequired.value).toLowerCase() === 'true',
              }
            : {}),
          ...(meta.Copyrighted?.value !== undefined
            ? { copyrighted: String(meta.Copyrighted.value).toLowerCase() === '1' || String(meta.Copyrighted.value).toLowerCase() === 'true' }
            : {}),
        });
        // Also index without File: prefix variants for lookup convenience
        map.set(fileTitle.replace(/^File:/i, ''), map.get(fileTitle)!);
      }

      if (i < batches.length - 1 && batchDelayMs > 0) {
        await sleep(batchDelayMs);
      }
    }
    return map;
  }

  return {
    resolveEnwikiTitles,
    fetchEntitiesById,
    fetchCommonsImageMetadata,
    batchSize,
  };
}

export type CommonsMediaClient = ReturnType<typeof createCommonsMediaClient>;
