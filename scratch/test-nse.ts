import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import { nseClient } from "../artifacts/api-server/src/lib/nse.js";

async function test() {
  try {
    console.log("Testing direct fetch to Nifty option chain...");
    // Let's print the actual cookies to see if they are set
    await nseClient.refreshSession();
    console.log("Session refreshed successfully!");
    
    // Fetch directly using the underlying fetch to see response text and headers
    const url = "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY";
    const API_HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      Referer: "https://www.nseindia.com/option-chain",
      "X-Requested-With": "XMLHttpRequest",
    };
    
    // get cookies from nseClient
    const cookies = (nseClient as any).cookies;
    console.log("Using Cookies:", cookies);
    
    const res = await fetch(url, {
      headers: { ...API_HEADERS, Cookie: cookies }
    });
    
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log("Body preview (1000 chars):", text.slice(0, 1000));
  } catch (err) {
    console.error("Error during test:", err);
  }
}

test();
