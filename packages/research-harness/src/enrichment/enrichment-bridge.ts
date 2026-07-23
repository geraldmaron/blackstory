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
  readonly coordinates?: { readonly latitude: number; readonly longitude: number } | undefined;
  readonly confidence: number;
  readonly claims: readonly {
    readonly id: string;
    readonly predicate: string;
    readonly object: string;
    readonly confidence: number;
    readonly citationUrl?: string | undefined;
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
  subject: HarnessRawSubject & { existingEntityId?: string | null },
  client: EnrichmentBridgeClient,
  theme: string,
  metro: string,
): Promise<EnrichedCandidate> {
  const isDuplicate = !!subject.existingEntityId;
  const backfillInstruction = isDuplicate
    ? `This candidate matches an existing canonical entity (${subject.existingEntityId}). Your primary goal is to EXTRACT AND BACKFILL missing biographical, geographical, or relationship claims from the provided text.`
    : `This is a new entity candidate. Your goal is to extract its core facts, coordinates, and historical context.`;

  const prompt = `
You are a domain-agnostic research assistant. Analyze the following raw entity/place record.
Theme Context: ${theme}
Metro Area: ${metro}

Title: ${subject.title}
Description: ${subject.description}
Coordinates: ${subject.coordinates ? `${subject.coordinates.latitude}, ${subject.coordinates.longitude}` : 'Unknown'}
State: ${subject.state || 'Unknown'}
County: ${subject.county || 'Unknown'}
Cites: ${subject.cites.join(', ') || 'None'}

INSTRUCTIONS:
1. ${backfillInstruction}
2. Think step-by-step. Validate geographic coordinates and temporal timelines before asserting facts.
3. Output the result in the exact JSON schema below.

{
  "reasoning": "Step-by-step logic validating your extractions and confidence scores",
  "title": "Normalized display name",
  "publicSummary": "A concise 1-2 sentence description of its significance to the theme",
  "historicalContext": "Paragraph placing this entity in the broader context of the theme (${theme})",
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
  let parsed: any;
  try {
    parsed = JSON.parse(cleanJsonResponse(responseText));
  } catch (e) {
    console.error('Failed to parse JSON response:', responseText);
    throw e;
  }

  const parsedLat = parsed.latitude ? parseFloat(parsed.latitude) : undefined;
  const parsedLng = parsed.longitude ? parseFloat(parsed.longitude) : undefined;

  const coords =
    parsedLat !== undefined && parsedLng !== undefined && !isNaN(parsedLat) && !isNaN(parsedLng)
      ? { latitude: parsedLat, longitude: parsedLng }
      : subject.coordinates;

  return {
    id: subject.id,
    title: parsed.title || subject.title,
    publicSummary: parsed.publicSummary || '',
    historicalContext: parsed.historicalContext || '',
    ...(coords ? { coordinates: coords } : {}),
    confidence: parsed.confidence || 0.5,
    claims: parsed.claims || [],
  };
}

/** Adjudicates a spatial-temporal co-occurrence relationship using the LLM client. */
export async function adjudicateRelationship(
  overlap: SpatialTemporalOverlap,
  client: EnrichmentBridgeClient,
  theme: string,
  metro: string,
): Promise<AdjudicatedRelationship> {
  const prompt = `
You are a domain-agnostic research assistant. Analyze the potential relationship between these two co-occurring entities.
Theme Context: ${theme}
Metro Area: ${metro}

Entity A:
- Title: ${overlap.subjectA.title}
- Description: ${overlap.subjectA.description}

Entity B:
- Title: ${overlap.subjectB.title}
- Description: ${overlap.subjectB.description}

Shared Temporal Windows: ${overlap.temporalWindows.join(', ')}
Geographic Distance: ${overlap.distanceMeters ? `${overlap.distanceMeters} meters` : 'Nearby'}

INSTRUCTIONS:
1. Think step-by-step. Validate the geographic and temporal alignment before asserting any relationship.
2. Decide if there is a direct connection (e.g. founder, benefactor, student, member, adjacent site).
3. Output the result in the exact JSON schema below.

{
  "reasoning": "Step-by-step logic validating the relationship based on geographic and temporal evidence",
  "relationType": "type from taxonomy (e.g., founder / member / associated_site / none)",
  "confidence": 0.0, // Float 0-1
  "rationale": "Concise historical evidence linking these two entities"
}
  `.trim();

  const responseText = await client.complete(prompt, 'adjudicated-relationship.v1');
  const parsed = JSON.parse(cleanJsonResponse(responseText));

  return {
    subjectAId: overlap.subjectA.id,
    subjectBId: overlap.subjectB.id,
    relationType: parsed.relationType || 'none',
    confidence: parsed.confidence || 0.0,
    rationale: parsed.rationale || '',
  };
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/iu, '').replace(/```$/u, '');
  }
  // Strip JS-style comments (avoid stripping URLs with http:// or https://)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
  return cleaned.trim();
}
