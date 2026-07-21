/**
 * Minimal browser session identity for Supabase admin auth.
 */
export type AdminSessionUser = {
  readonly uid: string;
  readonly email: string;
};
