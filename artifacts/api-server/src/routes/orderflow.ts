import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

export interface MarketDepth {
  price: number;
  quantity: number;
  orders: number;
}

export interface BlockTrade {
  id: string;
  timestamp: string;
  price: number;
  quantity: number;
  type: "BUY" | "SELL";
  value: number; // price * quantity
}

// Generate synthetic market depth (DOM)
function generateDepth(basePrice: number): { bids: MarketDepth[], asks: MarketDepth[] } {
  const bids: MarketDepth[] = [];
  const asks: MarketDepth[] = [];
  
  // Tick size approx 0.05
  let currentBid = basePrice - 0.05;
  let currentAsk = basePrice + 0.05;

  for (let i = 0; i < 15; i++) {
    bids.push({
      price: Number(currentBid.toFixed(2)),
      quantity: Math.floor(Math.random() * 5000) + 100,
      orders: Math.floor(Math.random() * 50) + 1,
    });
    currentBid -= 0.05;

    asks.push({
      price: Number(currentAsk.toFixed(2)),
      quantity: Math.floor(Math.random() * 5000) + 100,
      orders: Math.floor(Math.random() * 50) + 1,
    });
    currentAsk += 0.05;
  }

  // Create artificial "walls" at psychological levels
  if (Math.random() > 0.5) bids[Math.floor(Math.random() * 5)].quantity += 25000;
  if (Math.random() > 0.5) asks[Math.floor(Math.random() * 5)].quantity += 25000;

  return { bids, asks };
}

// Generate synthetic block trades (Iceberg/Institutional)
function generateBlockTrades(basePrice: number): BlockTrade[] {
  const trades: BlockTrade[] = [];
  const count = Math.floor(Math.random() * 10) + 5;
  
  for (let i = 0; i < count; i++) {
    const qty = Math.floor(Math.random() * 50000) + 10000; // Large sizes
    const priceOffset = (Math.random() - 0.5) * 5;
    const price = Number((basePrice + priceOffset).toFixed(2));
    
    trades.push({
      id: `blk-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 300000)).toISOString(), // Last 5 minutes
      price,
      quantity: qty,
      type: Math.random() > 0.5 ? "BUY" : "SELL",
      value: price * qty
    });
  }

  // Sort descending by timestamp
  return trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

router.get("/depth/:symbol", (req: Request, res: Response) => {
  try {
    const symbolStr = req.params.symbol as string;
    const symbol = symbolStr.toUpperCase();
    // In a real app we'd fetch the live LTP for the symbol. For mocking, we hash the string to get a stable base price.
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    const basePrice = 1000 + (Math.abs(hash) % 2000); 

    const depth = generateDepth(basePrice);
    res.json({ success: true, data: depth });
  } catch (err) {
    logger.error({ err }, "Market depth fetch error");
    res.status(500).json({ success: false, error: "Failed to fetch depth" });
  }
});

router.get("/blocks/:symbol", (req: Request, res: Response) => {
  try {
    const symbolStr = req.params.symbol as string;
    const symbol = symbolStr.toUpperCase();
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    const basePrice = 1000 + (Math.abs(hash) % 2000);

    const blocks = generateBlockTrades(basePrice);
    res.json({ success: true, data: blocks });
  } catch (err) {
    logger.error({ err }, "Block trades fetch error");
    res.status(500).json({ success: false, error: "Failed to fetch block trades" });
  }
});

export default router;
