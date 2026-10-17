/** Preserve the research packet; import its supported sections into the existing story store. */
import { createHash } from 'node:crypto';
import { type StoryBodyBlockDoc, type StoryDraft } from '@repo/schemas';
import { getStoryPacket } from '../stories/story-packet-store';
import { readStory, saveStory, type Actor } from './store';
export async function importStoryPacket(actor: Actor, submissionId: string) {
  const id = `story_packet_${createHash('sha256').update(submissionId).digest('hex').slice(0, 24)}`;
  const existing = await readStory(id);
  if (existing) return { id, slug: existing.draft.slug, revision: existing.revision };
  const item = await getStoryPacket(submissionId);
  if (!item) throw new Error('Story packet not found.');
  const packet = item.packet,
    body: StoryBodyBlockDoc[] = [];
  for (const section of packet.draft.body) {
    if (section.heading) body.push({ type: 'heading', level: 2, text: section.heading });
    body.push(...section.paragraphs.map((text) => ({ type: 'paragraph' as const, text })));
    for (const moment of section.moments ?? []) {
      if (moment.kind === 'observation' || moment.kind === 'derived')
        body.push({
          type: 'stat',
          packetId: moment.packetId,
          refId: moment.refId,
          kind: moment.kind,
        });
      if (moment.kind === 'artifact')
        body.push({ type: 'primaryDocument', packetId: moment.packetId, refId: moment.refId });
      if (moment.kind === 'timeline') body.push({ type: 'timeline', packetId: moment.packetId });
      if (moment.kind === 'map')
        throw new Error(
          'This packet contains a map moment without an entity binding. Resolve it in research before import.',
        );
    }
    body.push(
      ...(section.disputes ?? []).map((dispute) => ({ type: 'dispute' as const, ...dispute })),
    );
  }
  const draft: StoryDraft = {
    id,
    slug: packet.draft.slug || `research-${id.slice(-12)}`,
    title: packet.draft.title,
    summary: packet.draft.dek,
    format: 'chapter',
    eraLabel: packet.draft.eraLabel,
    placeLabel: packet.draft.placeLabel,
    publishedAt: new Date().toISOString().slice(0, 10),
    tags: [],
    body,
    references: packet.authorityLeadUrls.map((url, i) => ({
      id: `source-${i + 1}`,
      label: url,
      url,
    })),
    relatedEntityIds: [...packet.relatedEntityIds],
    contributors: [],
  };
  // Imported sources are discovery leads, not fabricated sentence-level citations or credits.
  return saveStory(
    actor,
    draft,
    0,
    `Import research packet ${submissionId}; citation and contributor review required`,
  );
}
