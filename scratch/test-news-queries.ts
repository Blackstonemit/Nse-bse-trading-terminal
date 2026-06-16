import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();

async function testQueries() {
  try {
    const queries = [
      "NIFTY 50",
      "Indian Rupee",
      "Gold price",
      "Crude Oil",
      "Indian business mergers"
    ];

    const results = await Promise.all(
      queries.map(q => {
        console.log(`Searching query: "${q}"...`);
        return yahooFinance.search(q, { newsCount: 5 }, { validateResult: false }).catch((err: any) => {
          console.error(`Query failed: "${q}":`, err);
          return { news: [] };
        });
      })
    );

    console.log("Results size:", results.length);
    const seen = new Set<string>();
    const allNews: any[] = [];

    for (let idx = 0; idx < results.length; idx++) {
      const r = results[idx];
      const q = queries[idx];
      console.log(`Query "${q}" returned ${r?.news?.length ?? 0} news items.`);
      
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

    console.log("All news count:", allNews.length);
    if (allNews.length > 0) {
      console.log("First news item tags:", allNews[0].tags);
      console.log("First news item details:", JSON.stringify(allNews[0], null, 2));
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testQueries();
