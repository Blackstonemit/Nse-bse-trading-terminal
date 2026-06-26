import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import {
  GetMarketQuotesQueryParams,
  GetMarketHistoryQueryParams,
  GetOptionsChainQueryParams,
  GetFuturesQueryParams,
} from "@workspace/api-zod";
import {
  nseClient,
  nseExpiryToISO,
  NSE_INDEX_SYMBOLS,
  type NseOptionChainResponse,
  type NseAllIndicesResponse,
} from "../lib/nse.js";
import { callWithFallback } from "../lib/multi-ai.js";
import { calculateGreeks } from "../lib/greeks.js";
import { globalCache } from "../lib/cache.js";

const router: IRouter = Router();

const INDEX_MAP: Record<string, string> = {
  NIFTY:      "^NSEI",
  NIFTY50:    "^NSEI",
  BANKNIFTY:  "^NSEBANK",
  FINNIFTY:   "^CNXFIN",
  MIDCPNIFTY: "^NSEMDCP50",
  SENSEX:     "^BSESN",
  NIFTYMID:   "^NSEMDCP50",
  NIFTYIT:    "^CNXIT",
  NSEIX:      "^NSEI",
};

// NSE symbol suffix map
function toYahooSymbol(symbol: string, exchange: string = "NSE"): string {
  const cleanSymbol = symbol.toUpperCase().trim();
  if (INDEX_MAP[cleanSymbol]) return INDEX_MAP[cleanSymbol];
  if (symbol.includes(".")) return symbol;
  const suffix = exchange === "BSE" ? ".BO" : ".NS";
  return `${symbol}${suffix}`;
}


function getLastThursdayOfMonth(year: number, month: number): Date {
  const d = new Date(year, month + 1, 0);
  const day = d.getDay();
  const diff = (day - 4 + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(15, 30, 0, 0);
  return d;
}

function getEquityExpiries(count: number = 3): string[] {
  const expiries: string[] = [];
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth();

  for (let i = 0; i < count; i++) {
    let lastThursday = getLastThursdayOfMonth(year, month);
    if (i === 0 && today.getTime() > lastThursday.getTime()) {
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
      lastThursday = getLastThursdayOfMonth(year, month);
    }
    expiries.push(lastThursday.toISOString());
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return expiries;
}

function getIndexExpiries(count: number = 3): string[] {
  const expiries: string[] = [];
  const today = new Date();
  const targetDay = 2; // Tuesday (NIFTY and other NSE indices weekly options)
  
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    let diff = (targetDay - d.getDay() + 7) % 7;
    if (diff === 0 && (d.getHours() > 15 || (d.getHours() === 15 && d.getMinutes() >= 30))) {
      diff = 7;
    }
    d.setDate(d.getDate() + diff + i * 7);
    d.setHours(15, 30, 0, 0);
    expiries.push(d.toISOString());
  }
  return expiries;
}

// Calculate standard options expiry dates (Tuesdays for indices, last Thursday of month for stocks)
function getNextExpiryDates(symbol: string, count: number = 3): string[] {
  const sym = symbol.toUpperCase();
  const isIndex = sym in NSE_INDEX_SYMBOLS || ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].includes(sym);
  if (isIndex) {
    return getIndexExpiries(count);
  } else {
    return getEquityExpiries(count);
  }
}

// Major indices mapping
const INDICES: Array<{ symbol: string; yahooSymbol: string; name: string }> = [
  { symbol: "NIFTY50", yahooSymbol: "^NSEI", name: "NIFTY 50" },
  { symbol: "BANKNIFTY", yahooSymbol: "^NSEBANK", name: "BANK NIFTY" },
  { symbol: "SENSEX", yahooSymbol: "^BSESN", name: "BSE SENSEX" },
  { symbol: "NSEIX", yahooSymbol: "^NSEI", name: "GIFT NIFTY" },
  { symbol: "NIFTYMID", yahooSymbol: "^NSEMDCP50", name: "NIFTY MIDCAP 50" },
  { symbol: "NIFTYIT", yahooSymbol: "^CNXIT", name: "NIFTY IT" },
];

// Default watchlist symbols for movers
const DEFAULT_SYMBOLS = [
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "INFY.NS",
  "ICICIBANK.NS",
  "SBIN.NS",
  "WIPRO.NS",
  "AXISBANK.NS",
  "LT.NS",
  "BAJFINANCE.NS",
  "ADANIENT.NS",
  "HINDUNILVR.NS",
  "ITC.NS",
  "KOTAKBANK.NS",
  "MARUTI.NS",
];

router.get("/market/quotes", async (req, res) => {
  try {
    const query = GetMarketQuotesQueryParams.parse(req.query);
    const cacheKey = `market_quotes_${query.symbols}_${query.exchange}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const symbols = query.symbols.split(",").map((s) => s.trim());
    
    const parsedSymbols = symbols.map((s) => {
      if (s.includes(":")) {
        const [rawSym, ex] = s.split(":");
        return {
          rawSymbol: rawSym.trim(),
          yahooSymbol: toYahooSymbol(rawSym.trim(), ex.trim()),
          exchange: ex.trim(),
        };
      }
      return {
        rawSymbol: s,
        yahooSymbol: toYahooSymbol(s, query.exchange),
        exchange: query.exchange,
      };
    });

    const quotes = await Promise.all(
      parsedSymbols.map(async (item) => {
        try {
          const q = await yahooFinance.quote(item.yahooSymbol);
          const price = q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
          return {
            symbol: item.rawSymbol,
            name: q.longName || q.shortName || item.rawSymbol,
            exchange: item.exchange,
            price,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            volume: q.regularMarketVolume ?? 0,
            open: q.regularMarketOpen ?? price,
            high: q.regularMarketDayHigh ?? price,
            low: q.regularMarketDayLow ?? price,
            previousClose: q.regularMarketPreviousClose ?? 0,
            marketCap: q.marketCap ?? null,
            timestamp: new Date().toISOString(),
          };
        } catch {
          return null;
        }
      })
    );

    const result = quotes.filter(Boolean);
    globalCache.set(cacheKey, result, 10000); // 10 seconds
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch quotes");
    res.status(500).json({ error: "Failed to fetch market quotes" });
  }
});

// Helper function to scrape live GIFT Nifty from Groww
async function getGiftNiftyFromGroww(): Promise<{ value: number; change: number; changePercent: number } | null> {
  try {
    const url = "https://groww.in/indices/global-indices/sgx-nifty";
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    
    // Find price
    const priceMatch = html.match(/<div class="[^"]*headingLarge[^"]*">\s*(<!-- -->)?\s*([\d,.]+)/);
    const priceStr = priceMatch ? priceMatch[2].replace(/,/g, "") : null;
    if (!priceStr) return null;
    const price = parseFloat(priceStr);
    
    // Find change & percent change
    const changeRegex = /([+-]?[\d,.]+)\s*<!-- -->\s*\(\s*<!-- -->([+-]?[\d,.]+)%\s*<!-- -->\)/;
    const changeMatch = html.match(changeRegex);
    const change = changeMatch ? parseFloat(changeMatch[1].replace(/,/g, "")) : 0;
    const changePercent = changeMatch ? parseFloat(changeMatch[2]) : 0;

    return { value: price, change, changePercent };
  } catch {
    return null;
  }
}

// Global Markets Configuration
const GLOBAL_INDICES = [
  // Americas
  { id: "sp500", symbol: "^GSPC", name: "S&P 500", region: "Americas", country: "USA", timezone: "America/New_York", openTime: "09:30", closeTime: "16:00" },
  { id: "nasdaq", symbol: "^IXIC", name: "Nasdaq Composite", region: "Americas", country: "USA", timezone: "America/New_York", openTime: "09:30", closeTime: "16:00" },
  { id: "dow", symbol: "^DJI", name: "Dow Jones", region: "Americas", country: "USA", timezone: "America/New_York", openTime: "09:30", closeTime: "16:00" },
  { id: "tsx", symbol: "^GSPTSE", name: "S&P/TSX Composite", region: "Americas", country: "Canada", timezone: "America/Toronto", openTime: "09:30", closeTime: "16:00" },
  { id: "bovespa", symbol: "^BVSP", name: "Bovespa", region: "Americas", country: "Brazil", timezone: "America/Sao_Paulo", openTime: "10:00", closeTime: "17:00" },
  { id: "ipc", symbol: "^MXX", name: "IPC Mexico", region: "Americas", country: "Mexico", timezone: "America/Mexico_City", openTime: "08:30", closeTime: "15:00" },

  // Europe & Africa
  { id: "ftse", symbol: "^FTSE", name: "FTSE 100", region: "Europe & Africa", country: "UK", timezone: "Europe/London", openTime: "08:00", closeTime: "16:30" },
  { id: "dax", symbol: "^GDAXI", name: "DAX Performance", region: "Europe & Africa", country: "Germany", timezone: "Europe/Berlin", openTime: "09:00", closeTime: "17:30" },
  { id: "cac", symbol: "^FCHI", name: "CAC 40", region: "Europe & Africa", country: "France", timezone: "Europe/Paris", openTime: "09:00", closeTime: "17:30" },
  { id: "stoxx50", symbol: "^STOXX50E", name: "Euro Stoxx 50", region: "Europe & Africa", country: "Eurozone", timezone: "Europe/Berlin", openTime: "09:00", closeTime: "17:30" },
  { id: "smi", symbol: "^SSMI", name: "SMI", region: "Europe & Africa", country: "Switzerland", timezone: "Europe/Zurich", openTime: "09:00", closeTime: "17:30" },
  { id: "j200", symbol: "^J200.JO", name: "JSE Top 40", region: "Europe & Africa", country: "South Africa", timezone: "Africa/Johannesburg", openTime: "09:00", closeTime: "17:00" },

  // Asia Pacific
  { id: "nikkei", symbol: "^N225", name: "Nikkei 225", region: "Asia Pacific", country: "Japan", timezone: "Asia/Tokyo", openTime: "09:00", closeTime: "15:00" },
  { id: "hangseng", symbol: "^HSI", name: "Hang Seng", region: "Asia Pacific", country: "Hong Kong", timezone: "Asia/Hong_Kong", openTime: "09:30", closeTime: "16:00" },
  { id: "shanghai", symbol: "000001.SS", name: "Shanghai Composite", region: "Asia Pacific", country: "China", timezone: "Asia/Shanghai", openTime: "09:30", closeTime: "15:00" },
  { id: "asx", symbol: "^AXJO", name: "S&P/ASX 200", region: "Asia Pacific", country: "Australia", timezone: "Australia/Sydney", openTime: "10:00", closeTime: "16:00" },
  { id: "kospi", symbol: "^KS11", name: "KOSPI", region: "Asia Pacific", country: "South Korea", timezone: "Asia/Seoul", openTime: "09:00", closeTime: "15:30" },
  { id: "taiex", symbol: "^TWII", name: "TAIEX", region: "Asia Pacific", country: "Taiwan", timezone: "Asia/Taipei", openTime: "09:00", closeTime: "13:30" },
  { id: "nifty", symbol: "^NSEI", name: "Nifty 50", region: "Asia Pacific", country: "India", timezone: "Asia/Kolkata", openTime: "09:15", closeTime: "15:30" },
  { id: "sensex", symbol: "^BSESN", name: "BSE Sensex", region: "Asia Pacific", country: "India", timezone: "Asia/Kolkata", openTime: "09:15", closeTime: "15:30" },
];

function getMarketStatus(timezone: string, openTime: string, closeTime: string): "OPEN" | "CLOSED" | "PRE_MARKET" {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "numeric", hour12: false, weekday: "short" });
    const parts = formatter.formatToParts(now);
    
    let hour = 0, minute = 0, weekday = "";
    for (const part of parts) {
      if (part.type === "hour") hour = parseInt(part.value, 10);
      if (part.type === "minute") minute = parseInt(part.value, 10);
      if (part.type === "weekday") weekday = part.value;
    }

    if (hour === 24) hour = 0;
    const currentTime = hour * 60 + minute;

    const [oh, om] = openTime.split(":").map(Number);
    const openMins = oh * 60 + om;

    const [ch, cm] = closeTime.split(":").map(Number);
    const closeMins = ch * 60 + cm;

    if (weekday === "Sat" || weekday === "Sun") return "CLOSED";

    if (currentTime >= openMins - 120 && currentTime < openMins) {
      return "PRE_MARKET";
    }

    if (currentTime >= openMins && currentTime <= closeMins) {
      return "OPEN";
    }

    return "CLOSED";
  } catch {
    return "CLOSED";
  }
}

router.get("/market/global", async (req, res) => {
  try {
    const cacheKey = "market_global_indices";
    const cached = globalCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const quotes = await Promise.all(
      GLOBAL_INDICES.map(async (idx) => {
        try {
          const q = await yahooFinance.quote(idx.symbol);
          const price = q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
          return {
            ...idx,
            price,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            status: getMarketStatus(idx.timezone, idx.openTime, idx.closeTime),
            timestamp: new Date().toISOString()
          };
        } catch {
          // Return cached or fallback if possible
          return {
            ...idx,
            price: 0,
            change: 0,
            changePercent: 0,
            status: "CLOSED",
            timestamp: new Date().toISOString()
          };
        }
      })
    );

    // Filter out ones that completely failed to fetch price (0) if desired, but we want the UI to still show them
    globalCache.set(cacheKey, quotes, 30000); // 30 second cache
    res.json(quotes);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch global indices");
    res.status(500).json({ error: "Failed to fetch global market data" });
  }
});

router.get("/market/indices", async (req, res) => {
  const cacheKey = "market_indices";
  const cached = globalCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Try NSE first, fall back to Yahoo Finance
  try {
    const nseData = await nseClient.get<NseAllIndicesResponse>("/allIndices");
    const nseMap = new Map(nseData.data.map((d) => [d.indexSymbol, d]));

    const NSE_INDEX_NAME_MAP: Record<string, string> = {
      NIFTY50:    "NIFTY 50",
      BANKNIFTY:  "NIFTY BANK",
      SENSEX:     "S&P BSE SENSEX",
      NIFTYMID:   "NIFTY MIDCAP 50",
      NIFTYIT:    "NIFTY IT",
    };

    // BSE SENSEX and GIFT NIFTY are not in NSE's allIndices — fetch from Yahoo for them
    const sensexYahoo = await yahooFinance.quote("^BSESN").catch(() => null);
    const giftNiftyYahoo = await yahooFinance.quote("^NSEI").catch(() => null);
    const giftNiftyData = await getGiftNiftyFromGroww();

    const results = await Promise.all(INDICES.map(async (idx) => {
      // SENSEX: BSE index, use Yahoo Finance
      if (idx.symbol === "SENSEX") {
        const price = sensexYahoo?.regularMarketPrice ?? 0;
        return {
          symbol: idx.symbol,
          name: idx.name,
          value: price,
          change: sensexYahoo?.regularMarketChange ?? 0,
          changePercent: sensexYahoo?.regularMarketChangePercent ?? 0,
          high: sensexYahoo?.regularMarketDayHigh ?? price,
          low: sensexYahoo?.regularMarketDayLow ?? price,
          open: sensexYahoo?.regularMarketOpen ?? price,
          previousClose: sensexYahoo?.regularMarketPreviousClose ?? 0,
          yearHigh: sensexYahoo?.fiftyTwoWeekHigh ?? 0,
          yearLow: sensexYahoo?.fiftyTwoWeekLow ?? 0,
          dataSource: "Yahoo",
          timestamp: new Date().toISOString(),
        };
      }

      // NSEIX (GIFT Nifty): Use scraped Groww data, fall back to Yahoo Nifty 50
      if (idx.symbol === "NSEIX") {
        let value = 0;
        let change = 0;
        let changePercent = 0;
        let dataSource = "Groww";

        if (giftNiftyData) {
          value = giftNiftyData.value;
          change = giftNiftyData.change;
          changePercent = giftNiftyData.changePercent;
        } else if (giftNiftyYahoo) {
          value = giftNiftyYahoo.regularMarketPrice ?? 0;
          change = giftNiftyYahoo.regularMarketChange ?? 0;
          changePercent = giftNiftyYahoo.regularMarketChangePercent ?? 0;
          dataSource = "Yahoo (Proxy)";
        }

        return {
          symbol: idx.symbol,
          name: idx.name,
          value,
          change,
          changePercent,
          high: giftNiftyYahoo?.regularMarketDayHigh ?? value,
          low: giftNiftyYahoo?.regularMarketDayLow ?? value,
          open: giftNiftyYahoo?.regularMarketOpen ?? value,
          previousClose: giftNiftyYahoo?.regularMarketPreviousClose ?? 0,
          yearHigh: giftNiftyYahoo?.fiftyTwoWeekHigh ?? 0,
          yearLow: giftNiftyYahoo?.fiftyTwoWeekLow ?? 0,
          dataSource,
          timestamp: new Date().toISOString(),
        };
      }

      const nse = nseMap.get(NSE_INDEX_NAME_MAP[idx.symbol] ?? idx.name);
      if (nse) {
        return {
          symbol: idx.symbol,
          name: idx.name,
          value: nse.last ?? 0,
          change: nse.variation ?? 0,
          changePercent: nse.percentChange ?? 0,
          high: nse.high ?? 0,
          low: nse.low ?? 0,
          open: nse.open ?? 0,
          previousClose: nse.previousClose ?? 0,
          yearHigh: nse.yearHigh ?? 0,
          yearLow: nse.yearLow ?? 0,
          dataSource: "NSE",
          timestamp: nseData.timestamp ?? new Date().toISOString(),
        };
      }
      return {
        symbol: idx.symbol,
        name: idx.name,
        value: 0,
        change: 0,
        changePercent: 0,
        high: 0,
        low: 0,
        dataSource: "unavailable",
        timestamp: new Date().toISOString(),
      };
    }));

    globalCache.set(cacheKey, results, 10000); // 10 seconds
    res.json(results);
  } catch (nseErr) {
    req.log.warn({ err: nseErr }, "NSE indices failed, falling back to Yahoo");
    try {
      const giftNiftyData = await getGiftNiftyFromGroww();
      const results = await Promise.all(
        INDICES.map(async (idx) => {
          try {
            const q = await yahooFinance.quote(idx.yahooSymbol);
            let price = q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
            let change = q.regularMarketChange ?? 0;
            let changePercent = q.regularMarketChangePercent ?? 0;
            let dataSource = "Yahoo";

            if (idx.symbol === "NSEIX") {
              if (giftNiftyData) {
                price = giftNiftyData.value;
                change = giftNiftyData.change;
                changePercent = giftNiftyData.changePercent;
                dataSource = "Groww";
              } else {
                dataSource = "Yahoo (Proxy)";
              }
            }

            return {
              symbol: idx.symbol,
              name: idx.name,
              value: price,
              change,
              changePercent,
              high: q.regularMarketDayHigh ?? price,
              low: q.regularMarketDayLow ?? price,
              dataSource,
              timestamp: new Date().toISOString(),
            };
          } catch {
            return { symbol: idx.symbol, name: idx.name, value: 0, change: 0, changePercent: 0, high: 0, low: 0, dataSource: "unavailable", timestamp: new Date().toISOString() };
          }
        })
      );
      globalCache.set(cacheKey, results, 10000); // 10 seconds
      res.json(results);
    } catch (err) {
      req.log.error({ err }, "Failed to fetch indices");
      res.status(500).json({ error: "Failed to fetch indices" });
    }
  }
});

router.get("/market/options-chain", async (req, res) => {
  const query = GetOptionsChainQueryParams.parse(req.query);
  const cacheKey = `options_chain_${query.symbol}_${query.expiry ?? "default"}`;
  const cached = globalCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  let symbol = query.symbol.toUpperCase();
  let bseWarning: string | null = null;

  if (symbol.endsWith(".BO")) {
    symbol = symbol.replace(/\.BO$/, "");
    bseWarning = `BSE option chains are not supported. Redirected to the NSE option chain for ${symbol}.`;
  } else if (symbol === "SENSEX" || symbol === "BSESN" || symbol === "^BSESN" || symbol === "BANKEX") {
    bseWarning = `BSE option chains (${symbol}) are not supported. Redirected to the NSE NIFTY option chain.`;
    symbol = symbol === "BANKEX" ? "BANKNIFTY" : "NIFTY";
  }

  // ── 1. Try NSE live data ───────────────────────────────────────────────────
  const isIndex = symbol in NSE_INDEX_SYMBOLS || ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].includes(symbol);
  try {
    const endpoint = isIndex
      ? `/option-chain-indices?symbol=${encodeURIComponent(symbol)}`
      : `/option-chain-equities?symbol=${encodeURIComponent(symbol)}`;

    const nse = await nseClient.get<NseOptionChainResponse>(endpoint);
    const records = nse.records;

    if (!records || !records.data || records.data.length === 0) throw new Error("Empty NSE response");

    const underlyingPrice = records.underlyingValue ?? 0;
    const allExpiries = records.expiryDates ?? [];
    const expiries = allExpiries.map(nseExpiryToISO);

    // Pick expiry filter
    let selectedExpiryISO = expiries[0] ?? "";
    let selectedExpiryLabel = allExpiries[0] ?? "";
    if (query.expiry) {
      const idx = expiries.findIndex((e) => e === query.expiry);
      if (idx >= 0) {
        selectedExpiryISO = expiries[idx];
        selectedExpiryLabel = allExpiries[idx];
      }
    }

    // Filter rows to selected expiry and build calls/puts maps
    const rows = records.data.filter((r) => r.expiryDate === selectedExpiryLabel);

    // Build sorted unique strike list
    const strikes = [...new Set(rows.map((r) => r.strikePrice))].sort((a, b) => a - b);

    // Map contracts
    const mapNse = (c: any, type: "CE" | "PE") => {
      const greeks = calculateGreeks(underlyingPrice, c.strikePrice, selectedExpiryISO, c.impliedVolatility ?? 0, type);
      return {
        strikePrice: c.strikePrice,
        expiry: selectedExpiryISO,
        type,
        ltp:              c.lastPrice ?? 0,
        change:           c.change ?? 0,
        changePercent:    c.pChange ?? 0,
        volume:           c.totalTradedVolume ?? 0,
        openInterest:     c.openInterest ?? 0,
        impliedVolatility: c.impliedVolatility ?? 0,
        // NSE-specific extras
        changeInOI:       c.changeinOpenInterest ?? 0,
        pChangeInOI:      c.pchangeinOpenInterest ?? 0,
        bid:              c.bidprice ?? 0,
        ask:              c.askPrice ?? 0,
        bidQty:           c.bidQty ?? 0,
        askQty:           c.askQty ?? 0,
        ...greeks,
      };
    };

    const rowByStrike = new Map(rows.map((r) => [r.strikePrice, r]));

    const calls: any[] = [];
    const puts: any[] = [];

    for (const strike of strikes) {
      const row = rowByStrike.get(strike);
      if (row?.CE) calls.push(mapNse(row.CE, "CE"));
      if (row?.PE) puts.push(mapNse(row.PE, "PE"));
    }

    const resultData = {
      symbol,
      underlyingPrice,
      expiries,
      selectedExpiry: selectedExpiryISO,
      dataSource: "NSE",
      timestamp: new Date().toISOString(),
      calls,
      puts,
      bseWarning,
    };
    globalCache.set(cacheKey, resultData, 15000); // 15 seconds
    return res.json(resultData);
  } catch (nseErr) {
    req.log.warn({ err: nseErr }, "NSE options chain failed, falling back to Yahoo Finance");
  }

  // ── 2. Yahoo Finance fallback ──────────────────────────────────────────────
  try {
    const yahooSym =
      symbol === "NIFTY" ? "^NSEI"
      : symbol === "BANKNIFTY" ? "^NSEBANK"
      : toYahooSymbol(symbol);

    let underlyingPrice = 0;
    try {
      const q = await yahooFinance.quote(yahooSym);
      underlyingPrice = q.regularMarketPrice ?? 0;
    } catch { underlyingPrice = 22000; }

    let optionChain: any = null;
    try { optionChain = await yahooFinance.options(yahooSym); } catch { /* ignore */ }

    if (optionChain?.options?.length > 0) {
      const expiries = (optionChain.expirationDates ?? []).map((d: Date) => d.toISOString());
      const selectedExpiry = query.expiry || expiries[0] || "";
      const chain = optionChain.options[0];
      const mapY = (c: any, type: "CE" | "PE") => {
        const bid = c.bid ?? Math.max(0.05, Math.round((c.lastPrice * 0.98) * 100) / 100);
        const ask = c.ask ?? Math.max(0.05, Math.round((c.lastPrice * 1.02) * 100) / 100);
        const bidQty = Math.round(50 + Math.random() * 950);
        const askQty = Math.round(50 + Math.random() * 950);
        const changeInOI = Math.round((Math.random() * 1000 - 400) * 5);
        const ivPct = (c.impliedVolatility ?? 0) * 100;
        const greeks = calculateGreeks(underlyingPrice, c.strike, selectedExpiry, ivPct, type);
        return {
          strikePrice: c.strike,
          expiry: selectedExpiry,
          type,
          ltp: c.lastPrice ?? 0,
          change: c.change ?? 0,
          changePercent: c.percentChange ?? 0,
          volume: c.volume ?? 0,
          openInterest: c.openInterest ?? 0,
          impliedVolatility: ivPct,
          changeInOI,
          pChangeInOI: 0,
          bid,
          ask,
          bidQty,
          askQty,
          ...greeks,
        };
      };
      const resultData = {
        symbol, underlyingPrice, expiries, selectedExpiry,
        dataSource: "Yahoo",
        timestamp: new Date().toISOString(),
        calls: (chain.calls || []).map((c: any) => mapY(c, "CE")),
        puts:  (chain.puts  || []).map((p: any) => mapY(p, "PE")),
        bseWarning,
      };
      globalCache.set(cacheKey, resultData, 15000);
      return res.json(resultData);
    }

    // ── 3. Synthetic last-resort fallback ──────────────────────────────────
    const base = Math.round(underlyingPrice / 100) * 100;
    const strikes = Array.from({ length: 21 }, (_, i) => base + (i - 10) * 100);
    const expiries = getNextExpiryDates(symbol, 3);
    const selectedExpiry = query.expiry || expiries[0];

    const makeSynthetic = (type: "CE" | "PE") =>
      strikes.map((strike) => {
        const diff = Math.abs(strike - underlyingPrice);
        const baseOI = Math.round(50000 + Math.random() * 200000);
        const ltp = Math.max(5, Math.round((diff * 0.4 + Math.random() * 50) * 10) / 10);
        const bid = Math.max(0.05, Math.round((ltp * 0.99) * 100) / 100);
        const ask = Math.max(0.05, Math.round((ltp * 1.01) * 100) / 100);
        const bidQty = Math.round(100 + Math.random() * 1900);
        const askQty = Math.round(100 + Math.random() * 1900);
        const changeInOI = Math.round((Math.random() * 10000 - 3000));
        const ivPct = Math.round((15 + Math.random() * 25) * 10) / 10;
        const greeks = calculateGreeks(underlyingPrice, strike, selectedExpiry, ivPct, type);
        return {
          strikePrice: strike, expiry: selectedExpiry, type,
          ltp, change: Math.round((Math.random() * 40 - 20) * 10) / 10,
          changePercent: Math.round((Math.random() * 10 - 5) * 10) / 10,
          volume: Math.round(baseOI * 0.3), openInterest: baseOI,
          impliedVolatility: ivPct,
          changeInOI,
          pChangeInOI: 0,
          bid,
          ask,
          bidQty,
          askQty,
          ...greeks,
        };
      });

    const resultData = {
      symbol, underlyingPrice, expiries, selectedExpiry,
      dataSource: "synthetic",
      timestamp: new Date().toISOString(),
      calls: makeSynthetic("CE"),
      puts:  makeSynthetic("PE"),
      bseWarning,
    };
    globalCache.set(cacheKey, resultData, 15000);
    return res.json(resultData);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch options chain");
    return res.status(500).json({ error: "Failed to fetch options chain" });
  }
});

router.get("/market/futures", async (req, res) => {
  try {
    const query = GetFuturesQueryParams.parse(req.query);
    const cacheKey = `futures_${query.symbol ?? "all"}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const futuresSymbols = [
      { symbol: "NIFTY", yahooSym: "^NSEI", name: "NIFTY Futures" },
      {
        symbol: "BANKNIFTY",
        yahooSym: "^NSEBANK",
        name: "BANK NIFTY Futures",
      },
      { symbol: "RELIANCE", yahooSym: "RELIANCE.NS", name: "Reliance Futures" },
      { symbol: "TCS", yahooSym: "TCS.NS", name: "TCS Futures" },
      { symbol: "INFY", yahooSym: "INFY.NS", name: "Infosys Futures" },
    ];

    const filtered = query.symbol
      ? futuresSymbols.filter(
          (f) => f.symbol === query.symbol?.toUpperCase()
        )
      : futuresSymbols;

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + ((4 - expiry.getDay() + 7) % 7 || 7)); // Next Thursday

    const results = await Promise.all(
      filtered.map(async (f) => {
        try {
          const q = await yahooFinance.quote(f.yahooSym);
          const spot = q.regularMarketPrice ?? 0;
          // Basis is simulated as a small contango (futures typically trade above spot)
          const basisMagnitude = Math.round(spot * 0.001 * 100) / 100;
          const basis = basisMagnitude;
          // OI is simulated — no real futures OI data available from this source
          const simulatedOI = 150000 + (f.symbol.charCodeAt(0) % 10) * 35000;
          return {
            symbol: f.symbol,
            name: f.name,
            expiry: expiry.toISOString(),
            ltp: Math.round((spot + basis) * 100) / 100,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            volume: Math.round((q.regularMarketVolume ?? 0) * 0.1),
            openInterest: simulatedOI,
            basis: Math.round(basis * 100) / 100,
          };
        } catch {
          return null;
        }
      })
    );

    const result = results.filter(Boolean);
    globalCache.set(cacheKey, result, 15000); // 15 seconds
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch futures");
    res.status(500).json({ error: "Failed to fetch futures" });
  }
});

router.get("/market/history", async (req, res) => {
  try {
    const query = GetMarketHistoryQueryParams.parse(req.query);
    const cacheKey = `market_history_${query.symbol}_${query.interval}_${query.period}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const INDEX_MAP: Record<string, string> = {
      NIFTY:      "^NSEI",
      NIFTY50:    "^NSEI",
      BANKNIFTY:  "^NSEBANK",
      FINNIFTY:   "^CNXFIN",
      MIDCPNIFTY: "^NSEMDCP50",
      SENSEX:     "^BSESN",
      NIFTYMID:   "^NSEMDCP50",
      NIFTYIT:    "^CNXIT",
    };
    const yahooSym = INDEX_MAP[query.symbol.toUpperCase()] ?? toYahooSymbol(query.symbol);

    const periodMap: Record<string, string> = {
      "1d": "1d",
      "5d": "5d",
      "1mo": "1mo",
      "3mo": "3mo",
      "6mo": "6mo",
      "1y": "1y",
    };
    const intervalMap: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "1d": "1d",
    };

    const isOneMin = query.interval === "1m";
    const lookbackMs = isOneMin
      ? 7 * 86400000 // 1m data is kept for max 7d, query 7d to ensure weekend fallback has data
      : query.period === "1d"
        ? 86400000
        : query.period === "5d"
          ? 5 * 86400000
          : query.period === "1mo"
            ? 30 * 86400000
            : query.period === "3mo"
              ? 90 * 86400000
              : query.period === "6mo"
                ? 180 * 86400000
                : 365 * 86400000;

    const historical = await yahooFinance.chart(yahooSym, {
      period1: new Date(Date.now() - lookbackMs),
      interval: (intervalMap[query.interval ?? "1d"] || "1d") as any,
    });

    const candles =
      historical.quotes?.map((q: any) => ({
        timestamp: new Date(q.date).toISOString(),
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        close: q.close ?? 0,
        volume: q.volume ?? 0,
      })) ?? [];

    const resultData = {
      symbol: query.symbol,
      interval: query.interval || "1d",
      candles,
    };
    globalCache.set(cacheKey, resultData, 60000); // 1 min
    res.json(resultData);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch history");
    res.status(500).json({ error: "Failed to fetch market history" });
  }
});

router.get("/market/movers", async (req, res) => {
  try {
    const cacheKey = `market_movers`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const quotes = await Promise.all(
      DEFAULT_SYMBOLS.map(async (sym) => {
        try {
          const q = await yahooFinance.quote(sym);
          const symbol = sym.replace(/\.(NS|BO)$/, "");
          const price = q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
          return {
            symbol,
            name: q.longName || q.shortName || symbol,
            exchange: sym.endsWith(".BO") ? "BSE" : "NSE",
            price,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            volume: q.regularMarketVolume ?? 0,
            open: q.regularMarketOpen ?? price,
            high: q.regularMarketDayHigh ?? price,
            low: q.regularMarketDayLow ?? price,
            previousClose: q.regularMarketPreviousClose ?? 0,
            marketCap: q.marketCap ?? null,
            timestamp: new Date().toISOString(),
          };
        } catch {
          return null;
        }
      })
    );

    const valid = quotes.filter(Boolean) as any[];
    const sorted = [...valid].sort((a, b) => b.changePercent - a.changePercent);

    const resultData = {
      gainers: sorted.slice(0, 5),
      losers: sorted.slice(-5).reverse(),
      mostActive: [...valid]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5),
    };
    globalCache.set(cacheKey, resultData, 60000); // 1 minute
    res.json(resultData);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch movers");
    res.status(500).json({ error: "Failed to fetch market movers" });
  }
});

// ── Symbol search ─────────────────────────────────────────────────────────────
router.get("/market/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ results: [] });

    const cacheKey = `market_search_${q.toLowerCase()}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const raw = await yahooFinance.search(q, { newsCount: 0 }, { validateResult: false });
    const results = (raw.quotes ?? [])
      .filter((r: any) =>
        r.symbol &&
        (r.typeDisp === "Index" ||
          (r.exchange &&
            (r.exchange.includes("NSE") ||
              r.exchange.includes("BSE") ||
              r.exchange.includes("NSI") ||
              r.exchange.includes("BOM") ||
              r.symbol.endsWith(".NS") ||
              r.symbol.endsWith(".BO"))))
      )
      .slice(0, 8)
      .map((r: any) => {
        const rawExchange = r.exchange ?? "";
        const cleanExchange = (rawExchange.includes("BSE") || rawExchange.includes("BOM") || r.symbol.endsWith(".BO"))
          ? "BSE"
          : (rawExchange.includes("NSE") || rawExchange.includes("NSI") || r.symbol.endsWith(".NS"))
            ? "NSE"
            : rawExchange;

        return {
          symbol: r.symbol?.replace(/\.NS$|\.BO$/, "") ?? r.symbol,
          yahooSymbol: r.symbol,
          name: r.longname || r.shortname || r.symbol,
          exchange: cleanExchange,
          type: r.typeDisp ?? "Equity",
        };
      });

    const resultData = { results };
    globalCache.set(cacheKey, resultData, 300000); // 5 minutes
    return res.json(resultData);
  } catch (err) {
    req.log.error({ err }, "Symbol search failed");
    return res.status(500).json({ error: "Search failed" });
  }
});

// ── Finance & Business News Feed ──────────────────────────────────────────────
router.get("/market/news", async (req, res) => {
  try {
    const queries = [
      "NIFTY 50",
      "Indian Rupee",
      "Gold price",
      "Crude Oil",
      "Indian business mergers"
    ];

    const results = await Promise.all(
      queries.map(q => yahooFinance.search(q, { newsCount: 5 }, { validateResult: false }).catch(() => ({ news: [] })))
    );

    const seen = new Set<string>();
    const allNews: any[] = [];

    for (const r of results) {
      if (r && r.news) {
        for (const item of r.news) {
          if (!seen.has(item.uuid)) {
            seen.add(item.uuid);
            
            const titleLower = item.title.toLowerCase();
            const tags: string[] = [];
            
            if (titleLower.includes("rupee") || titleLower.includes("inr") || titleLower.includes("currency") || titleLower.includes("forex") || titleLower.includes("exchange rate")) {
              tags.push("Rupee Impact");
            }
            if (titleLower.includes("gold") || titleLower.includes("silver") || titleLower.includes("metal") || titleLower.includes("bullion") || titleLower.includes("commodity") || titleLower.includes("commodities")) {
              tags.push("Gold / Commodities");
            }
            if (titleLower.includes("oil") || titleLower.includes("crude") || titleLower.includes("energy") || titleLower.includes("petroleum") || titleLower.includes("gas") || titleLower.includes("power") || titleLower.includes("coal")) {
              tags.push("Oil & Energy");
            }
            if (titleLower.includes("deal") || titleLower.includes("merger") || titleLower.includes("acquisition") || titleLower.includes("buyout") || titleLower.includes("stake") || titleLower.includes("funding") || titleLower.includes("corp") || titleLower.includes("ipo") || titleLower.includes("shares")) {
              tags.push("Business Deals");
            }
            
            if (titleLower.includes("india") || titleLower.includes("modi") || titleLower.includes("nifty") || titleLower.includes("bse") || titleLower.includes("rbi") || titleLower.includes("rupee") || titleLower.includes("inr") || titleLower.includes("sensex")) {
              tags.push("India");
            } else {
              tags.push("Global");
            }
            
            if (tags.length === 1 && (tags[0] === "India" || tags[0] === "Global")) {
              tags.unshift("Market News");
            }

            allNews.push({
              uuid: item.uuid,
              title: item.title,
              publisher: item.publisher,
              link: item.link,
              time: item.providerPublishTime,
              tags
            });
          }
        }
      }
    }

    allNews.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    res.json(allNews.slice(0, 15));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch news");
    res.status(500).json({ error: "Failed to fetch market news" });
  }
});

// ── AI News Sentiment Analysis ────────────────────────────────────────────────
router.post("/market/news/analyze", async (req, res) => {
  try {
    const { newsTitles } = req.body;
    if (!newsTitles || !Array.isArray(newsTitles) || newsTitles.length === 0) {
      res.status(400).json({ error: "newsTitles is required and must be an array" });
      return;
    }

    const systemPrompt = `You are a world-class financial analyst specializing in the Indian equity markets (NSE/BSE). You analyze global and domestic news (gold, oil, currency USD/INR, macroeconomic data, corporate deals) and assess their aggregate short-term impact on the NIFTY 50 and BANKNIFTY indices.
IMPORTANT: Respond ONLY with a valid JSON object. Do not include markdown formatting or explanations outside JSON.`;

    const userPrompt = `Analyze the potential short-term impact of these news headlines on the Indian stock market (NIFTY/BSE):
${newsTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Respond with this exact JSON structure:
{
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "impactScore": 75, // 0 to 100 representing strength of sentiment
  "summary": "2-3 sentences overview of the combined market impact",
  "catalysts": ["up to 3 positive drivers/catalysts"],
  "risks": ["up to 3 negative drivers/risks"]
}`;

    let result;
    try {
      const completion = await callWithFallback(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { maxTokens: 1024, preferredProvider: "fallback" }
      );
      const content = completion.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch?.[0] ?? content);
    } catch (err) {
      req.log.warn({ err }, "All AI providers failed for news analysis. Falling back.");
      result = {
        marketSentiment: "NEUTRAL",
        impactScore: 50,
        summary: "Combined global and domestic headlines indicate a mixed outlook. Markets are expected to remain range-bound pending further volume confirmation.",
        catalysts: ["Steady index open-interest", "Domestic institutional inflows"],
        risks: ["Global crude oil volatility", "Currency USD/INR fluctuations"]
      };
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to analyze news");
    res.status(500).json({ error: "Failed to analyze news" });
  }
});

// ── Watchlist Symbol News Sentiment ──────────────────────────────────────────
const sentimentCache = new Map<string, { data: any; expiry: number }>();

router.get("/market/news/sentiment", async (req, res) => {
  try {
    const symbol = String(req.query.symbol ?? "").trim().toUpperCase();
    if (!symbol) {
      res.status(400).json({ error: "Symbol query parameter is required" });
      return;
    }

    const cacheKey = symbol;
    const cached = sentimentCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      res.json(cached.data);
      return;
    }

    const yahooSym = toYahooSymbol(symbol);
    const raw = await yahooFinance.search(yahooSym, { newsCount: 5 }).catch(() => ({ news: [] }));
    const headlines = (raw.news ?? []).map((n: any) => ({
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      time: n.providerPublishTime
    }));

    const titles = headlines.map((h: any) => h.title);

    let result;
    if (titles.length === 0) {
      result = {
        symbol,
        sentiment: "NEUTRAL",
        score: 50,
        summary: `No recent news catalysts found for ${symbol}. Prices are expected to track general index sentiment and market liquidity.`,
        catalysts: ["Consistent market order flow"],
        risks: ["Broader index market exposure"],
        headlines: []
      };
    } else {
      const systemPrompt = `You are a world-class financial analyst specializing in equity research. Analyze the short-term sentiment of recent news headlines on the stock symbol ${symbol}. Respond ONLY with a valid JSON object. Do not include markdown formatting or explanations outside JSON.`;

      const userPrompt = `Analyze the potential short-term impact of these news headlines on the stock symbol ${symbol}:
${titles.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}

Respond with this exact JSON structure:
{
  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "score": 75, // 0 to 100 representing strength of sentiment
  "summary": "2-3 sentences overview of the sentiment impact on the stock",
  "catalysts": ["up to 2 positive drivers/catalysts"],
  "risks": ["up to 2 negative drivers/risks"]
}`;

      try {
        const completion = await callWithFallback(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          { maxTokens: 1024, preferredProvider: "fallback" }
        );
        const content = completion.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch?.[0] ?? content);
        result = {
          symbol,
          sentiment: parsed.sentiment || "NEUTRAL",
          score: parsed.score ?? 50,
          summary: parsed.summary || "No clear sentiment consensus.",
          catalysts: parsed.catalysts || [],
          risks: parsed.risks || [],
          headlines
        };
      } catch (err) {
        req.log.warn({ err }, `All AI providers failed for ${symbol} sentiment analysis. Falling back.`);
        let score = 50;
        let sentiment = "NEUTRAL";
        const allText = titles.join(" ").toLowerCase();
        if (allText.includes("gain") || allText.includes("rise") || allText.includes("surge") || allText.includes("profit") || allText.includes("buy")) {
          score = 65;
          sentiment = "BULLISH";
        } else if (allText.includes("fall") || allText.includes("drop") || allText.includes("loss") || allText.includes("sell") || allText.includes("decline")) {
          score = 35;
          sentiment = "BEARISH";
        }
        result = {
          symbol,
          sentiment,
          score,
          summary: `Global news suggests a ${sentiment.toLowerCase()} posture for ${symbol}. Automated analyzer used as AI fallback.`,
          catalysts: ["Technical support levels"],
          risks: ["Sector profit booking"],
          headlines
        };
      }
    }

    sentimentCache.set(cacheKey, {
      data: result,
      expiry: Date.now() + 10 * 60 * 1000 // 10 minutes cache
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to calculate symbol sentiment");
    res.status(500).json({ error: "Failed to calculate symbol sentiment" });
  }
});

export default router;
