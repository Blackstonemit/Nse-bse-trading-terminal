import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();

async function testNews() {
  try {
    console.log("Querying news from Yahoo Finance...");
    // Search with newsCount > 0
    const res = await yahooFinance.search("Indian stock market", { newsCount: 5 });
    console.log("Search result keys:", Object.keys(res));
    console.log("News count:", res.news?.length);
    if (res.news && res.news.length > 0) {
      console.log("First news item:", JSON.stringify(res.news[0], null, 2));
    }
  } catch (err) {
    console.error("Failed to query news:", err);
  }
}

testNews();
