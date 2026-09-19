import { test, expect } from '@playwright/test';

test.describe('NSE/BSE AI Trading Terminal E2E Verification', () => {
  let sessionCookie = '';

  test.beforeAll(async ({ request }) => {
    // Perform authentication with maxRedirects: 0 to capture Set-Cookie header directly
    const authRes = await request.get('http://127.0.0.1:8080/api/auth/google/callback?code=mock_auth_code', {
      maxRedirects: 0,
    });
    expect([200, 302]).toContain(authRes.status());
    const rawCookie = authRes.headers()['set-cookie'] || '';
    // Extract token=...
    const match = rawCookie.match(/token=[^;]+/);
    sessionCookie = match ? match[0] : '';
    expect(sessionCookie).toBeTruthy();
  });

  test('Health check endpoint is responsive', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:8080/api/healthz');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
  });

  test('Commodities desk data integrity', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8080/api/commodities', {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('nationalGold24k');
    expect(data).toHaveProperty('nationalSilver1kg');
    expect(Array.isArray(data.cities)).toBe(true);
    expect(data.nationalGold24k).toBeGreaterThan(50000);
  });

  test('Consolidated Fundamentals search works for popular and specific queries', async ({ request }) => {
    // Test query-less search (popular symbols fallback)
    const emptyRes = await request.get('http://127.0.0.1:8080/api/fundamentals/search', {
      headers: { Cookie: sessionCookie },
    });
    expect(emptyRes.ok()).toBeTruthy();
    const popular = await emptyRes.json();
    expect(Array.isArray(popular)).toBe(true);
    expect(popular.length).toBeGreaterThan(0);

    // Test specific query
    const symRes = await request.get('http://127.0.0.1:8080/api/fundamentals/search?q=TCS', {
      headers: { Cookie: sessionCookie },
    });
    expect(symRes.ok()).toBeTruthy();
    const symData = await symRes.json();
    expect(Array.isArray(symData)).toBe(true);
    expect(symData.length).toBeGreaterThan(0);
  });

  test('Conviction Picks endpoint returns curated research picks', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8080/api/conviction-picks', {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('picks');
    expect(Array.isArray(data.picks)).toBe(true);
    expect(data.picks.length).toBeGreaterThan(0);
  });

  test('Volume Shockers screener returns surge metrics', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8080/api/volume-shockers', {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('shockers');
    expect(Array.isArray(data.shockers)).toBe(true);
    expect(data.shockers.length).toBeGreaterThan(0);
  });
});
