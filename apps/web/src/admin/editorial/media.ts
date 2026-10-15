/** Private uploads are content addressed; only approved release copies become public. */
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { editorialWrite, type Actor } from './store';
import { queryPostgres } from '../lib/canonical-postgres-client';
export function editorialStorage(): ReturnType<typeof createClient>['storage'] {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Media storage is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    .storage;
}
export async function uploadEditorialMedia(
  actor: Actor,
  articleId: string,
  file: File,
  credit: string,
  rights: string,
) {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 5242880 ||
    !file.size
  )
    throw new Error('Choose a PNG, JPEG or WebP image up to 5 MB.');
  if (!credit.trim() || !['public_domain', 'licensed', 'fair_use'].includes(rights))
    throw new Error('Image credit and rights are required.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid =
    file.type === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.type === 'image/jpeg'
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!valid) throw new Error('The file content does not match its image type.');
  const hash = createHash('sha256').update(bytes).digest('hex'),
    id = randomUUID();
  return editorialWrite(
    actor,
    'research:write',
    articleId,
    'article.media',
    'Attach image with recorded credit and rights',
    async (db) => {
      const row = await db.query('SELECT id FROM reference.articles WHERE id=$1 FOR SHARE', [
        articleId,
      ]);
      if (!row.rows.length) throw new Error('Save the article before uploading an image.');
      const path = `${articleId}/${hash}/${id}`;
      const result = await editorialStorage()
        .from('editorial-media')
        .upload(path, bytes, { contentType: file.type, upsert: false });
      if (
        result.error &&
        !['409', 'Duplicate'].includes(String(result.error.statusCode)) &&
        !result.error.message.toLowerCase().includes('already exists')
      )
        throw new Error('Image storage failed. Please retry.');
      const saved = await db.query<{ id: string }>(
        `INSERT INTO reference.editorial_media(id,article_id,content_type,object_path,content_hash,byte_length,credit,rights_status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(object_path) DO UPDATE SET object_path=EXCLUDED.object_path RETURNING id`,
        [id, articleId, file.type, path, hash, bytes.length, credit, rights, actor.uid],
      );
      return {
        url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048'}/admin/stories/media/${saved.rows[0]!.id}`,
        alt: '',
        credit,
        rightsStatus: rights,
      };
    },
  );
}
export async function readEditorialMedia(id: string) {
  const rows = await queryPostgres<{ object_path: string; content_type: string }>(
    'SELECT object_path,content_type FROM reference.editorial_media WHERE id=$1',
    [id],
  );
  if (!rows[0]) return null;
  const result = await editorialStorage().from('editorial-media').download(rows[0].object_path);
  if (result.error || !result.data) throw new Error('Image is unavailable.');
  return { bytes: await result.data.arrayBuffer(), contentType: rows[0].content_type };
}
