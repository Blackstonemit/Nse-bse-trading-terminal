async function testGroww() {
  try {
    const url = "https://groww.in/indices/global-indices/sgx-nifty";
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
    const html = await res.text();
    
    // Find price
    const priceMatch = html.match(/<div class="[^"]*headingLarge[^"]*">\s*(<!-- -->)?\s*([\d,.]+)/);
    const priceStr = priceMatch ? priceMatch[2].replace(/,/g, "") : null;
    const price = priceStr ? parseFloat(priceStr) : 0;
    
    // Find change & percent change
    // HTML: +395.00<!-- --> (<!-- -->1.67%<!-- -->)
    const changeRegex = /([+-]?[\d,.]+)\s*<!-- -->\s*\(\s*<!-- -->([+-]?[\d,.]+)%\s*<!-- -->\)/;
    const changeMatch = html.match(changeRegex);
    const change = changeMatch ? parseFloat(changeMatch[1].replace(/,/g, "")) : 0;
    const changePercent = changeMatch ? parseFloat(changeMatch[2]) : 0;

    console.log({
      rawPriceMatch: priceMatch ? priceMatch[0] : null,
      rawChangeMatch: changeMatch ? changeMatch[0] : null,
      price,
      change,
      changePercent
    });
  } catch (err) {
    console.error("Error scraping Groww:", err);
  }
}

testGroww();
