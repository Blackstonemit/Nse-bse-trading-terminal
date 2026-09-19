import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

export interface GoogleQuote {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  marketCap: number | null;
  timestamp: string;
}

// Map stock symbol and exchange to Google Finance symbol structure
export function toGoogleFinanceSymbol(symbol: string, defaultExchange: string = "NSE"): { ticker: string; exchange: string } {
  const s = symbol.toUpperCase().trim();
  
  // Index mappings
  if (s === "^NSEI" || s === "NIFTY" || s === "NIFTY50" || s === "NIFTY 50") {
    return { ticker: "NIFTY_50", exchange: "INDEXNSE" };
  }
  if (s === "^NSEBANK" || s === "BANKNIFTY" || s === "BANK NIFTY") {
    return { ticker: "NIFTY_BANK", exchange: "INDEXNSE" };
  }
  if (s === "^BSESN" || s === "SENSEX" || s === "BSE SENSEX") {
    return { ticker: "SENSEX", exchange: "INDEXBOM" };
  }
  if (s === "^CNXFIN" || s === "FINNIFTY") {
    return { ticker: "NIFTY_FIN_SERVICE", exchange: "INDEXNSE" };
  }
  if (s === "^NSEMDCP50" || s === "MIDCPNIFTY" || s === "NIFTYMID") {
    return { ticker: "NIFTY_MID_SELECT", exchange: "INDEXNSE" };
  }
  if (s === "^CNXIT" || s === "NIFTYIT") {
    return { ticker: "NIFTY_IT", exchange: "INDEXNSE" };
  }

  // Handle Yahoo suffixes
  if (s.endsWith(".NS")) {
    return { ticker: s.slice(0, -3), exchange: "NSE" };
  }
  if (s.endsWith(".BO")) {
    return { ticker: s.slice(0, -3), exchange: "BSE" };
  }

  // If it's a 6 digit number, it's BSE
  if (/^\d{6}$/.test(s)) {
    return { ticker: s, exchange: "BSE" };
  }

  return { ticker: s, exchange: defaultExchange };
}

interface CacheEntry {
  quote: GoogleQuote;
  fetchedAt: number;
}

const quoteCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000; // 5 seconds individual cache TTL for responsive real-time streaming

export class GoogleFinanceClient {
  /**
   * Scrapes stock or index quote from Google Finance website with 0-delay real-time data.
   * If scraping fails, it silently falls back to Yahoo Finance.
   */
  static async getQuote(symbol: string, defaultExchange: string = "NSE"): Promise<GoogleQuote> {
    const { ticker, exchange } = toGoogleFinanceSymbol(symbol, defaultExchange);
    const cacheKey = `${ticker}:${exchange}`;
    const now = Date.now();
    const cached = quoteCache.get(cacheKey);
    if (cached && (now - cached.fetchedAt < CACHE_TTL_MS)) {
      return {
        ...cached.quote,
        symbol: symbol.toUpperCase(),
      };
    }

    const url = `https://www.google.com/finance/quote/${ticker}:${exchange}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(5000), // 5 seconds timeout
      });

      if (!res.ok) {
        throw new Error(`Google Finance returned status ${res.status}`);
      }

      const html = await res.text();

      // 1. Price extraction with multi-pattern fallbacks
      let price = 0;
      const ujgMatch = html.match(/class="ujg0He"[^>]*>([\s\S]*?)<\/div><\/div><\/div>/i);
      const mainBlock = ujgMatch ? ujgMatch[1] : html;

      const priceMatch = mainBlock.match(/class="N6SYTe"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i)
        || mainBlock.match(/jsname="Pdsbrc"[^>]*><span>([^<]+)<\/span>/i)
        || html.match(/class="[^"]*YMlKec[^"]*fxKbKc[^"]*"[^>]*>\s*([^<]+)/i)
        || html.match(/₹\s*([\d,]+(?:\.\d+)?)/);

      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(/[^\d.]/g, ""));
      }

      if (!price || isNaN(price)) {
        throw new Error("Could not parse price from Google Finance HTML");
      }

      // 2. Change and ChangePercent
      let change = 0;
      let changePercent = 0;

      const isDownward = /arrow_downward/i.test(mainBlock);
      const isUpward = /arrow_upward/i.test(mainBlock);

      const chgMatch = mainBlock.match(/jsname="xnruHf"[^>]*><span>([^<]+)<\/span>/i)
        || html.match(/([+-]?[\d,.]+)\s*\(\s*([+-]?[\d,.]+)%\s*\)/);
      if (chgMatch) {
        const rawChg = parseFloat(chgMatch[1].replace(/[^\d.-]/g, ""));
        change = isDownward ? -Math.abs(rawChg) : (isUpward ? Math.abs(rawChg) : rawChg);
      }

      const pctMatch = mainBlock.match(/jsname="vY9t3b"[^>]*><span[^>]*>([^<]+)<\/span>/i);
      if (pctMatch) {
        const rawPct = parseFloat(pctMatch[1].replace(/[^\d.-]/g, ""));
        changePercent = isDownward ? -Math.abs(rawPct) : (isUpward ? Math.abs(rawPct) : rawPct);
      } else if (chgMatch && chgMatch[2]) {
        changePercent = parseFloat(chgMatch[2]);
      }

      // 3. Stats table
      const openMatch = html.match(/class="SwQK7">\s*Open\s*<\/div><div class="dO6ijd">₹?([\d,.]+)/i);
      const highMatch = html.match(/class="SwQK7">\s*High\s*<\/div><div class="dO6ijd">₹?([\d,.]+)/i);
      const lowMatch  = html.match(/class="SwQK7">\s*Low\s*<\/div><div class="dO6ijd">₹?([\d,.]+)/i);
      const prevMatch = html.match(/class="SwQK7">\s*Prev(?:ious)?(?:\s*close|\. close)?\s*<\/div><div class="dO6ijd">₹?([\d,.]+)/i);

      const open = openMatch ? parseFloat(openMatch[1].replace(/[^\d.]/g, "")) : price;
      const high = highMatch ? parseFloat(highMatch[1].replace(/[^\d.]/g, "")) : price;
      const low  = lowMatch  ? parseFloat(lowMatch[1].replace(/[^\d.]/g, ""))  : price;
      const previousClose = prevMatch ? parseFloat(prevMatch[1].replace(/[^\d.]/g, "")) : (price - change);

      // 4. Volume
      const volMatch = html.match(/class="SwQK7">\s*Volume\s*<\/div><div class="dO6ijd">([^<]+)/i);
      let volume = 0;
      if (volMatch) {
        const vStr = volMatch[1].trim().toUpperCase();
        const vNum = parseFloat(vStr.replace(/[^\d.]/g, ""));
        if (!isNaN(vNum)) {
          if (vStr.includes("M")) volume = Math.round(vNum * 1000000);
          else if (vStr.includes("K")) volume = Math.round(vNum * 1000);
          else if (vStr.includes("B")) volume = Math.round(vNum * 1000000000);
          else if (vStr.includes("CR")) volume = Math.round(vNum * 10000000);
          else volume = Math.round(vNum);
        }
      }

      // 5. Market Cap
      const mcapMatch = html.match(/class="SwQK7">\s*Mkt\.?\s*cap\s*<\/div><div class="dO6ijd">([^<]+)/i);
      let marketCap = null;
      if (mcapMatch) {
        const mStr = mcapMatch[1].trim().toUpperCase();
        const mNum = parseFloat(mStr.replace(/[^\d.]/g, ""));
        if (!isNaN(mNum)) {
          if (mStr.includes("T")) marketCap = mNum * 1000000000000;
          else if (mStr.includes("B")) marketCap = mNum * 1000000000;
          else if (mStr.includes("M")) marketCap = mNum * 1000000;
          else if (mStr.includes("CR")) marketCap = mNum * 10000000;
          else if (mStr.includes("L")) marketCap = mNum * 100000;
          else marketCap = mNum;
        }
      }

      // 6. Name
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      let name = symbol;
      if (titleMatch) {
        name = titleMatch[1].replace(/\s*\([^)]*\)\s*Stock Price.*$/i, "").replace(/\s*-\s*Google Finance.*$/i, "").replace(/\s*Price,\s*Real-time.*$/i, "").trim();
      }

      const quote: GoogleQuote = {
        symbol: symbol.toUpperCase(),
        name,
        exchange: exchange === "INDEXNSE" || exchange === "INDEXBOM" ? "INDEX" : exchange,
        price,
        change,
        changePercent,
        volume,
        open,
        high,
        low,
        previousClose,
        marketCap,
        timestamp: new Date().toISOString(),
      };

      quoteCache.set(cacheKey, { quote, fetchedAt: Date.now() });
      return quote;
    } catch (err: any) {
      console.warn(`[Google Finance] Scraper failed for ${ticker}:${exchange}. Falling back to Yahoo. Error:`, err.message);
      return this.getYahooFallback(symbol, defaultExchange);
    }
  }

  private static async getYahooFallback(symbol: string, defaultExchange: string): Promise<GoogleQuote> {
    const cleanSymbol = symbol.toUpperCase().trim();
    
    // Map to Yahoo Finance symbol format
    let yahooSymbol = cleanSymbol;
    if (!cleanSymbol.includes(".")) {
      if (["NIFTY", "NIFTY50", "NIFTY 50"].includes(cleanSymbol)) {
        yahooSymbol = "^NSEI";
      } else if (["BANKNIFTY", "BANK NIFTY"].includes(cleanSymbol)) {
        yahooSymbol = "^NSEBANK";
      } else if (["SENSEX", "BSE SENSEX"].includes(cleanSymbol)) {
        yahooSymbol = "^BSESN";
      } else {
        const suffix = defaultExchange === "BSE" ? ".BO" : ".NS";
        yahooSymbol = `${cleanSymbol}${suffix}`;
      }
    }

    const q = await yahooFinance.quote(yahooSymbol);
    const price = q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
    
    const quote: GoogleQuote = {
      symbol: symbol.toUpperCase(),
      name: q.longName || q.shortName || symbol,
      exchange: defaultExchange,
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

    const { ticker, exchange } = toGoogleFinanceSymbol(cleanSymbol, defaultExchange);
    const cacheKey = `${ticker}:${exchange}`;
    quoteCache.set(cacheKey, { quote, fetchedAt: Date.now() });

    return quote;
  }
}
