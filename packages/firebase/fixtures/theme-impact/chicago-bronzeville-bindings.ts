/**
 * Seed notes for Chicago redlining pilot entity_context_bindings.
 * Live rows were applied via Supabase for ent_bronzeville_001 ↔ Cook ACS metrics.
 * Re-run SQL in upsert-bronzeville-bindings.sql if environments need replay.
 */
export const CHICAGO_PILOT_ENTITY_ID = 'ent_bronzeville_001' as const;
export const CHICAGO_PILOT_JURISDICTION = 'county:17031' as const;
export const CHICAGO_PILOT_BINDING_IDS = [
  'ecb_bronzeville_homeownership_map',
  'ecb_bronzeville_homeownership_story',
  'ecb_bronzeville_income_map',
  'ecb_bronzeville_income_story',
  'ecb_bronzeville_popshare_map',
  'ecb_bronzeville_poverty_story',
] as const;
