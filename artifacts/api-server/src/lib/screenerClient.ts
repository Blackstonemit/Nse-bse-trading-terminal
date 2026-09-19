import { globalCache } from "./cache.js";
import { logger } from "./logger.js";

// Cache key for session cookie
const CACHE_KEY_COOKIE = "screener_session_cookie";

export async function fetchScreenerSymbols(
  query: string,
  credentials?: { username?: string; password?: string }
): Promise<string[]> {
  const username = credentials?.username || process.env.SCREENER_USERNAME;
  const password = credentials?.password || process.env.SCREENER_PASSWORD;

  if (!username || !password) {
    logger.warn("No Screener.in credentials provided or configured. Skipping fetch.");
    return [];
  }

  try {
    let sessionCookie = globalCache.get<string>(CACHE_KEY_COOKIE);

    if (!sessionCookie) {
      logger.info({ username }, "Logging in to Screener.in...");
      // Step 1: GET login page to extract CSRF token
      const getRes = await fetch("https://www.screener.in/login/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      const getHtml = await getRes.text();
      const csrfMatch = getHtml.match(/name="csrfmiddlewaretoken" value="([^"]+)"/);
      if (!csrfMatch) {
        throw new Error("Failed to extract CSRF token from login page");
      }
      const csrfToken = csrfMatch[1];

      // Extract initial cookies (mainly csrftoken)
      const setCookieHeaders = getRes.headers.getSetCookie();
      let initCookieStr = "";
      for (const cookie of setCookieHeaders) {
        initCookieStr += cookie.split(";")[0] + "; ";
      }

      // Step 2: POST login form
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);
      body.append("csrfmiddlewaretoken", csrfToken);

      const postRes = await fetch("https://www.screener.in/login/", {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": initCookieStr || `csrftoken=${csrfToken}`,
          "Referer": "https://www.screener.in/login/",
        },
        body: body.toString(),
        redirect: "manual",
      });

      // Get session cookies
      const postCookieHeaders = postRes.headers.getSetCookie();
      if (postCookieHeaders.length === 0) {
        throw new Error("Login failed: Screener did not return cookies");
      }

      let newCookieStr = "";
      for (const cookie of postCookieHeaders) {
        newCookieStr += cookie.split(";")[0] + "; ";
      }

      sessionCookie = newCookieStr;
      // Cache session for 24 hours
      globalCache.set(CACHE_KEY_COOKIE, sessionCookie, 24 * 60 * 60 * 1000);
      logger.info("Successfully authenticated with Screener.in");
    }

    // Step 3: Fetch the query results
    logger.info({ query }, "Executing Screener.in query...");
    const url = `https://www.screener.in/screen/raw/?q=${encodeURIComponent(query)}`;
    const screenRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": sessionCookie,
      },
    });

    // Check if we got redirected back to login (session expired)
    if (screenRes.status === 302 || screenRes.url.includes("/login/")) {
      logger.warn("Screener.in session expired. Retrying login...");
      globalCache.delete(CACHE_KEY_COOKIE);
      return fetchScreenerSymbols(query, credentials);
    }

    const html = await screenRes.text();
    // Parse symbols from href="/company/SYMBOL/
    const matches = [...html.matchAll(/\/company\/([A-Z0-9_\-]+)\//g)];
    const symbols = [...new Set(matches.map((m) => m[1].toUpperCase()))];
    logger.info({ count: symbols.length }, "Parsed company symbols from Screener.in");
    return symbols;
  } catch (err) {
    logger.error({ err }, "Error running Screener.in query");
    return [];
  }
}
