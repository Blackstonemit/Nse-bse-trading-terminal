/**
 * Returns the base URL for API requests, stripping any trailing slash.
 * In development (Vite proxy), BASE_URL is "/" so this returns "".
 * In Electron production, BASE_URL may be "/dashboard/" etc.
 */
export const apiBase = (): string =>
  (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

/**
 * Builds a full API URL from a path (must start with "/api/...").
 * Example: apiUrl("/api/news") → "/api/news" in dev, "/dashboard/api/news" in prod
 */
export const apiUrl = (path: string): string => `${apiBase()}${path}`;
