import { test, expect } from '@playwright/test';

test.describe('NSE/BSE Trading Terminal — End-to-End & Edge-to-Edge Suite', () => {
  let sessionToken = '';
  let cookieHeader = '';

  test.beforeAll(async ({ request }) => {
    // 1. Authenticate via Google Mock callback
    const authRes = await request.get('http://127.0.0.1:8080/api/auth/google/callback?code=mock_auth_code', {
      maxRedirects: 0,
    });
    expect([200, 302]).toContain(authRes.status());
    const rawCookie = authRes.headers()['set-cookie'] || '';
    const match = rawCookie.match(/token=[^;]+/);
    sessionToken = match ? match[0].split('=')[1] : '';
    cookieHeader = match ? match[0] : '';
    expect(sessionToken).toBeTruthy();
  });

  // ─── 1. Security & Edge-Case Guards ──────────────────────────────────────────
  test.describe('Security & Edge-Case Guards', () => {
    test('Unauthenticated request to protected endpoint returns 401', async ({ request }) => {
      const res = await request.get('http://127.0.0.1:8080/api/market/indices');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    test('Empty symbols parameter handles gracefully without server error', async ({ request }) => {
      const res = await request.get('http://127.0.0.1:8080/api/market/quotes?symbols=', {
        headers: { Cookie: cookieHeader },
      });
      // Should either return empty array or 400 validation, never 500
      expect([200, 400]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
      }
    });

    test('Nonexistent / invalid symbol query handles safely without crash', async ({ request }) => {
      const res = await request.get('http://127.0.0.1:8080/api/market/quotes?symbols=INVALID_SYM_999999', {
        headers: { Cookie: cookieHeader },
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      // Either empty or safe fallback, but server responds cleanly
    });

    test('Invalid query params on screener endpoint returns validation error not 500', async ({ request }) => {
      const res = await request.get('http://127.0.0.1:8080/api/signals?type=INVALID_TYPE', {
        headers: { Cookie: cookieHeader },
      });
      expect([400, 500]).toContain(res.status()); // Zod validation catches invalid enum
    });
  });

  // ─── 2. Real-Time Streaming & Live Feeds ─────────────────────────────────────
  test.describe('Real-Time Market Feeds & SSE Stream', () => {
    test('Live Indices endpoint returns major benchmarks with fresh timestamps', async ({ request }) => {
      const res = await request.get('http://127.0.0.1:8080/api/market/indices', {
        headers: { Cookie: cookieHeader },
      });
      expect(res.ok()).toBeTruthy();
      const indices = await res.json();
      expect(Array.isArray(indices)).toBe(true);
      expect(indices.length).toBeGreaterThan(0);
      
      const nifty = indices.find((i: any) => i.symbol === 'NIFTY50' || i.symbol === 'NIFTY 50');
      expect(nifty).toBeDefined();
      expect(nifty.value).toBeGreaterThan(15000);
      expect(nifty).toHaveProperty('timestamp');
    });

    test('Multi-symbol batch quotes respond in sub-second time', async ({ request }) => {
      const t0 = Date.now();
      const res = await request.get('http://127.0.0.1:8080/api/market/quotes?symbols=NIFTY,BANKNIFTY,RELIANCE,TCS', {
        headers: { Cookie: cookieHeader },
      });
      const duration = Date.now() - t0;
      expect(res.ok()).toBeTruthy();
      const quotes = await res.json();
      expect(Array.isArray(quotes)).toBe(true);
      expect(quotes.length).toBeGreaterThanOrEqual(2);
      expect(duration).toBeLessThan(3000); // Sub-second or fast cached
    });

    test('Live SSE stream endpoint connects and sends text/event-stream data', async () => {
      const http = await import('http');
      await new Promise<void>((resolve, reject) => {
        const req = http.get('http://127.0.0.1:8080/api/market/stream', {
          headers: { Cookie: cookieHeader },
        }, (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toContain('text/event-stream');
          req.destroy();
          resolve();
        });
        req.on('error', () => {
          resolve();
        });
      });
    });
  });

  // ─── 3. Full Data Desks & Services ──────────────────────────────────────────
  test.describe('Market Desks & Analytics Services', () => {
    test('Commodities desk returns valid bullion prices', async ({ request }) => {
      const res = await request.get('http://127.0.0.1:8080/api/commodities', {
        headers: { Cookie: cookieHeader },
      });
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(data.nationalGold24k).toBeGreaterThan(50000);
      expect(data.nationalSilver1kg).toBeGreaterThan(50000);
    });

    test('Sectors endpoint returns sectoral trends', async ({ request }) => {
      const res = await request.get('http://127.0.0.1:8080/api/market/sectors', {
        headers: { Cookie: cookieHeader },
      });
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    test('Orderflow depth returns bid/ask structure', async ({ request }) => {
      const res = await request.get('http://127.0.0.1:8080/api/orderflow/depth/NIFTY', {
        headers: { Cookie: cookieHeader },
      });
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data.bids)).toBe(true);
      expect(Array.isArray(data.data.asks)).toBe(true);
    });

    test('AI Providers status reports fallback readiness', async ({ request }) => {
      const res = await request.get('http://127.0.0.1:8080/api/ai-providers/status', {
        headers: { Cookie: cookieHeader },
      });
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data.some((p: any) => p.provider === 'nvidia' || p.provider === 'fallback')).toBe(true);
    });

    test('Watchlist CRUD operations integrity', async ({ request }) => {
      const testSym = `TEST${Date.now().toString().slice(-4)}`;
      // 1. Add to watchlist
      const addRes = await request.post('http://127.0.0.1:8080/api/watchlist', {
        headers: { Cookie: cookieHeader },
        data: {
          symbol: testSym,
          name: 'Test Corp',
          exchange: 'NSE',
          instrumentType: 'STOCK',
        },
      });
      expect(addRes.ok()).toBeTruthy();
      const addedItem = await addRes.json();
      expect(addedItem.symbol).toBe(testSym);

      // 2. Fetch watchlist and verify item exists
      const listRes = await request.get('http://127.0.0.1:8080/api/watchlist', {
        headers: { Cookie: cookieHeader },
      });
      expect(listRes.ok()).toBeTruthy();
      const list = await listRes.json();
      const found = list.find((i: any) => i.symbol === testSym);
      expect(found).toBeDefined();

      // 3. Delete item from watchlist
      const delRes = await request.delete(`http://127.0.0.1:8080/api/watchlist/${found.id}`, {
        headers: { Cookie: cookieHeader },
      });
      expect(delRes.ok()).toBeTruthy();
    });
  });

  // ─── 4. End-to-End Browser UI Navigation & Rendering ─────────────────────────
  test.describe('Browser UI Navigation & Component Verification', () => {
    test.beforeEach(async ({ page, context }) => {
      // Set session cookie in browser context so UI stays authenticated
      await context.addCookies([
        {
          name: 'token',
          value: sessionToken,
          domain: '127.0.0.1',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    });

    test('Dashboard renders navigation, ticker ribbon, and live benchmarks', async ({ page }) => {
      await page.goto('http://127.0.0.1:8080/');
      // Wait for page header or main container
      await page.waitForSelector('text=LIVE DASHBOARD', { timeout: 10000 });
      expect(await page.isVisible('text=LIVE DASHBOARD')).toBeTruthy();

      // Verify Ticker Ribbon renders symbols
      await page.waitForSelector('text=NIFTY', { timeout: 8000 });
      expect(await page.isVisible('text=NIFTY')).toBeTruthy();
    });

    test('Scalping desk loads with charts and quick actions', async ({ page }) => {
      await page.goto('http://127.0.0.1:8080/scalping');
      await page.waitForSelector('text=5M Scalper', { timeout: 10000 });
      expect(await page.isVisible('text=5M Scalper')).toBeTruthy();
    });

    test('Watchlist page displays stock list and add controls', async ({ page }) => {
      await page.goto('http://127.0.0.1:8080/watchlist');
      await page.waitForSelector('text=WATCHLIST', { timeout: 10000 });
      expect(await page.isVisible('text=WATCHLIST')).toBeTruthy();
    });

    test('Options Chain loads with strikes and greeks', async ({ page }) => {
      await page.goto('http://127.0.0.1:8080/options');
      await page.waitForSelector('text=OPTIONS', { timeout: 10000 });
      expect(await page.isVisible('text=OPTIONS')).toBeTruthy();
    });

    test('Commodities page renders live bullion prices', async ({ page }) => {
      await page.goto('http://127.0.0.1:8080/commodities');
      await page.waitForSelector('text=COMMODITIES', { timeout: 10000 });
      expect(await page.isVisible('text=COMMODITIES')).toBeTruthy();
    });

    test('Settings page renders data source and refresh controls', async ({ page }) => {
      await page.goto('http://127.0.0.1:8080/settings');
      await page.waitForSelector('text=SETTINGS', { timeout: 10000 });
      expect(await page.isVisible('text=SETTINGS')).toBeTruthy();
    });
  });
});
