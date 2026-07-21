/**
 * Minimal browser session identity shared by Firebase and Supabase admin auth paths.
 */
export type AdminSessionUser = {
  readonly uid: string;
  readonly email: string;
};
