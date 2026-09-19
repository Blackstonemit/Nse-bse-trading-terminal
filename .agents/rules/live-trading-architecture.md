# Live Trading Terminal Architecture & Packaging Guidelines

## 1. Low-Latency Market Data Streaming
- **Batch Quote Fetching**: Never fetch stock quotes individually in parallel loops (`symbols.map(s => quote(s))`). Always batch symbols into a single API query (e.g., `yahooFinance.quote(symbolArray)`) to minimize latency (<300ms) and avoid rate-limiting.
- **Strict Race Timeouts on External Scraping**: Anti-bot protected exchanges (e.g. NSE India) frequently hang on cookie challenges or Akamai blocks. Always wrap scrape attempts in a strict timeout race (<= 1500ms) with instant fallback to Google Finance / Yahoo Finance.
- **TanStack Query Client Stale Times**: For live market terminal dashboards, never set global `staleTime` above 2000ms. Enable `refetchOnWindowFocus: true` and `refetchOnReconnect: true`.
- **Trading View Refresh Cadence**:
  - Intraday Scalping & Order Flow: 2000ms
  - Live Ticker Ribbon & Watchlists: 2000ms – 3000ms
  - Market Indices & Movers: 3000ms – 5000ms
  - Global Markets & Macro: 15000ms
- **Server-Sent Events (SSE)**: Provide SSE endpoints (`/api/market/stream`) for clients requiring push updates without polling overhead.

## 2. Desktop Packaging Invariants
- `artifacts/desktop-app/build.js` copies compiled bundles from `artifacts/api-server/dist` and `artifacts/market-dashboard/dist`.
- Whenever rebuilding the desktop package (`TradingTerminal.exe` / installer), always compile both backend and frontend first, or execute `pnpm dist:desktop`.
