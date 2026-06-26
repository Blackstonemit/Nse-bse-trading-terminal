import app from "../artifacts/api-server/src/app";
import { initDb } from "../lib/db/src";
import http from "http";

async function testEndpoints() {
  console.log("Starting API Endpoints Integration Test...");
  process.env.DATABASE_URL = "file:test-api-run.db";

  try {
    console.log("Initializing database schema...");
    await initDb();
    console.log("Database initialized.");

    const port = 3099;
    const server = http.createServer(app);

    await new Promise<void>((resolve, reject) => {
      server.listen(port, "127.0.0.1", () => {
        console.log(`Test server listening on http://127.0.0.1:${port}`);
        resolve();
      });
      server.on("error", reject);
    });

    const baseUrl = `http://127.0.0.1:${port}/api`;

    // 1. Authenticate with mock credentials to get a session cookie
    console.log("Authenticating with mock credentials...");
    const authRes = await fetch(`${baseUrl}/auth/google/callback?code=mock_auth_code`, {
      redirect: "manual" // Stop the redirect to capture the cookie
    });
    const setCookieHeader = authRes.headers.get("set-cookie") || "";
    const sessionCookie = setCookieHeader.split(";")[0]; // extract token=xyz
    
    if (!sessionCookie) {
      throw new Error("Failed to receive session cookie from mock auth");
    }
    console.log("Session cookie retrieved successfully.");

    const tests = [
      { name: "Health check", path: "/healthz" },
      { name: "Market indices", path: "/market/indices" },
      { name: "Market movers", path: "/market/movers" },
      { name: "Market quotes (RELIANCE)", path: "/market/quotes?symbols=RELIANCE&exchange=NSE" },
      { name: "Market history (RELIANCE)", path: "/market/history?symbol=RELIANCE&interval=1d&period=1d" },
      { name: "Symbol search (TCS)", path: "/market/search?q=TCS" },
      { name: "Technical Analysis (RELIANCE)", path: "/analysis/technical?symbol=RELIANCE&interval=1d" },
      { name: "Analysis Summary", path: "/analysis/summary" },
      { name: "List Signals", path: "/signals" },
      { name: "Watchlist list", path: "/watchlist" },
      { name: "Scheduler status", path: "/scheduler/status" },
    ];

    for (const test of tests) {
      console.log(`[TEST] Querying ${test.name} (${test.path})...`);
      const res = await fetch(`${baseUrl}${test.path}`, {
        headers: { Cookie: sessionCookie }
      });
      console.log(`[RESPONSE] Status: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const text = await res.text();
        console.error(`[ERROR] Fail response:`, text);
        throw new Error(`Endpoint ${test.path} failed with status ${res.status}`);
      }
      const data = await res.json();
      console.log(`[SUCCESS] Retrieved valid JSON.`);
    }

    console.log("Stopping test server...");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log("Test server stopped.");

    console.log("All API endpoints tests passed successfully!");
  } catch (err) {
    console.error("API Integration Test failed:", err);
    process.exit(1);
  } finally {
    const fs = require("fs");
    try {
      fs.unlinkSync("test-api-run.db");
    } catch {}
  }
}

testEndpoints();
