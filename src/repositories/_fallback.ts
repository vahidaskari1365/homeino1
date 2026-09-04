/**
 * When DATABASE_URL is set but the database is unreachable (offline, wrong
 * host, build-time prerender), fall back to the shipped mock catalogs so
 * `next build` never crashes.
 */
export async function withDbFallback<T>(mock: T, remote: () => Promise<T>): Promise<T> {
  if (!process.env.DATABASE_URL) return mock;
  try {
    return await remote();
  } catch {
    return mock;
  }
}
