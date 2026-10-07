/**
 * Cold-storage switch. With `METIS_PAUSED=true` the Supabase project is
 * paused (or gone): accounts, login, history and saved connections are off,
 * and the site runs as the no-login tool at `/reporting` behind the access
 * code. Unset it (and resume the database) to bring accounts back — no code
 * change needed.
 */
export function isMetisPaused(): boolean {
  return process.env.METIS_PAUSED?.trim().toLowerCase() === "true";
}
