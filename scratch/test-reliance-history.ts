import app from "../artifacts/api-server/src/app";
import { initDb } from "../lib/db/src";
import http from "http";

async function testRelianceHistory() {
  process.env.DATABASE_URL = "file:test-reliance-run.db";

  try {
    await initDb();
    const port = 3105;
    const server = http.createServer(app);

    await new Promise<void>((resolve, reject) => {
      server.listen(port, "127.0.0.1", () => {
        resolve();
      });
      server.on("error", reject);
    });

    const baseUrl = `http://127.0.0.1:${port}/api`;
    const path = "/market/history?symbol=RELIANCE&interval=5m&period=5d";
    
    console.log(`Querying ${path}...`);
    const res = await fetch(`${baseUrl}${path}`);
    console.log(`Response Status: ${res.status} ${res.statusText}`);
    
    const text = await res.text();
    console.log("Response Text preview (first 500 chars):", text.slice(0, 500));
    
    if (res.ok) {
      const data = JSON.parse(text);
      console.log("Number of candles returned:", data.candles?.length);
      if (data.candles && data.candles.length > 0) {
        console.log("First candle details:", JSON.stringify(data.candles[0]));
        console.log("Last candle details:", JSON.stringify(data.candles[data.candles.length - 1]));
      }
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    const fs = require("fs");
    try {
      fs.unlinkSync("test-reliance-run.db");
    } catch {}
  }
}

testRelianceHistory();
