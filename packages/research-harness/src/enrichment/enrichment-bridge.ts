import type { HarnessRawSubject } from '../core/connector.js';
import type { SpatialTemporalOverlap } from '../core/adjacency.js';

export interface EnrichmentBridgeClient {
  readonly complete: (
    prompt: string,
    schemaName?: string,
    schema?: Record<string, unknown>
  ) => Promise<string>;
}

export interface EnrichedCandidate {
  readonly id: string;
  readonly title: string;
  readonly publicSummary: string;
  readonly historicalContext: string;
  readonly coordinates?: { readonly latitude: number; readonly longitude: number };
  readonly confidence: number;
  readonly claims: readonly {
    readonly id: string;
    readonly predicate: string;
    readonly object: string;
    readonly confidence: number;
    readonly citationUrl?: string;
  }[];
}

export interface AdjudicatedRelationship {
  readonly subjectAId: string;
  readonly subjectBId: string;
  readonly relationType: string;
  readonly confidence: number;
  readonly rationale: string;
}

/** Enriches a raw subject candidate using the LLM client. */
export async function enrichSubjectCandidate(
  subject: HarnessRawSubject,
  client: EnrichmentBridgeClient,
): Promise<EnrichedCandidate> {
  const prompt = `
You are a historical research assistant. Enrich the following raw entity/place record.
Title: ${subject.title}
Description: ${subject.description}
Coordinates: ${subject.coordinates ? `${subject.coordinates.latitude}, ${subject.coordinates.longitude}` : 'Unknown'}
State: ${subject.state || 'Unknown'}
County: ${subject.county || 'Unknown'}
Cites: ${subject.cites.join(', ') || 'None'}

Provide the response in the following JSON format:
{
  "title": "Normalized display name",
  "publicSummary": "A concise 1-2 sentence description of the historical significance",
  "historicalContext": "Paragraph placing this entity in the context of general Black history",
  "latitude": 0.0, // Float, optional
  "longitude": 0.0, // Float, optional
  "confidence": 0.0, // Float 0-1
  "claims": [
    {
      "id": "unique-claim-id",
      "predicate": "fact category/relationship",
      "object": "fact details/claim text",
      "confidence": 0.0, // Float 0-1
      "citationUrl": "URL from cites list"
    }
  ]
}
  `.trim();

  const responseText = await client.complete(prompt, 'enriched-candidate.v1');
  const parsed = JSON.parse(responseText);

  const coords =
    parsed.latitude !== undefined && parsed.longitude !== undefined
      ? { latitude: parsed.latitude, longitude: parsed.longitude }
      : subject.coordinates;

  return {
    id: subject.id,
    title: parsed.title || subject.title,
    publicSummary: parsed.publicSummary || '',
    historicalContext: parsed.historicalContext || '',
    coordinates: coords,
    confidence: parsed.confidence || 0.5,
    claims: parsed.claims || [],
  };
}

/** Adjudicates a spatial-temporal co-occurrence relationship using the LLM client. */
export async function adjudicateRelationship(
  overlap: SpatialTemporalOverlap,
  client: EnrichmentBridgeClient,
): Promise<AdjudicatedRelationship> {
  const prompt = `
Analyze the potential historical relationship between these two co-occurring entities:
Entity A:
- Title: ${overlap.subjectA.title}
- Description: ${overlap.subjectA.description}

Entity B:
- Title: ${overlap.subjectB.title}
- Description: ${overlap.subjectB.description}

Shared Policy Eras: ${overlap.policyEras.join(', ')}
Geographic Distance: ${overlap.distanceMeters ? `${overlap.distanceMeters} meters` : 'Nearby'}

Decide if there is a direct historical connection (e.g. founder, benefactor, student, member, adjacent site) based on the relationship taxonomy.
Provide the response in the following JSON format:
{
  "relationType": "type from taxonomy (e.g., founder / member / associated_site / none)",
  "confidence": 0.0, // Float 0-1
  "rationale": "Historical evidence and reasoning linking these two entities"
}
  `.trim();

  const responseText = await client.complete(prompt, 'adjudicated-relationship.v1');
  const parsed = JSON.parse(responseText);

  return {
    subjectAId: overlap.subjectA.id,
    subjectBId: overlap.subjectB.id,
    relationType: parsed.relationType || 'none',
    confidence: parsed.confidence || 0.0,
    rationale: parsed.rationale || '',
  };
}
