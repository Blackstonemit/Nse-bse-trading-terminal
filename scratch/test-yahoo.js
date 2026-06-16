import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new YahooFinanceClass();

async function testTickers() {
  const tickers = ["GIFTY=F", "^NSEIX", "NSEIX", "^NSEI", "IN50=F", "NIFTY50.NS"];
  for (const ticker of tickers) {
    try {
      const quote = await yahooFinance.quote(ticker);
      console.log(`Ticker: ${ticker} -> Price: ${quote?.regularMarketPrice}, Change: ${quote?.regularMarketChange}`);
    } catch (err) {
      console.log(`Ticker: ${ticker} -> Error: ${err.message}`);
    }
  }
}

testTickers();
