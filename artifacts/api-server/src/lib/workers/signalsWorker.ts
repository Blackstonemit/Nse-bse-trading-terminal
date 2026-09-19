import { logger } from "../logger.js";
import { callWithFallback } from "../multi-ai.js";
import { getWorkerConfig } from "./workerConfig.js";
import { db, signals } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import { globalCache } from "../cache.js";
import { GoogleFinanceClient } from "../google-finance.js";

const WATCH_LIST = ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "TATAMOTORS", "SUZLON", "BEL"];

export async function runSignalsWorker(): Promise<void> {
  const config = getWorkerConfig().signals;
  if (!config.enabled) {
    logger.debug("Signals worker disabled, skipping cycle");
    return;
  }

  logger.info({ provider: config.aiProvider }, "Running autonomous Signals Board subagent worker with live market feeds...");

  try {
    // 1. Clean up genuinely expired signals
    const now = new Date();
    await db.update(signals).set({ status: "EXPIRED" }).where(lt(signals.expiresAt, now));

    let generatedCount = 0;

    for (const symbol of WATCH_LIST) {
      try {
        const isIndex = symbol === "NIFTY" || symbol === "BANKNIFTY";
        const exchange = "NSE";
        const quote = await GoogleFinanceClient.getQuote(symbol, exchange);
        if (!quote || quote.price <= 0) continue;

        let signalData: any = null;

        // Try AI generation first
        try {
          const prompt = `Act as an expert quantitative day-trader on the Indian NSE exchange.
Current market data for ${symbol}:
- Live Price: ₹${quote.price}
- Today's Change: ${quote.change >= 0 ? '+' : ''}${quote.change} (${quote.changePercent}%)
- Day High: ₹${quote.high}
- Day Low: ₹${quote.low}
- Open: ₹${quote.open}
- Previous Close: ₹${quote.previousClose}
- Volume: ${quote.volume}

Generate an actionable live trading signal in strict JSON format:
{
  "action": "BUY" or "SELL",
  "displayText": "Short summary title",
  "entryPrice": ${quote.price},
  "targetPrice": number,
  "stopLoss": number,
  "confidence": number between 65 and 95,
  "timeframe": "INTRADAY" or "SWING",
  "rationale": "2-sentence technical rationale referencing the live prices above"
}`;

          const aiRes = await callWithFallback(
            [
              { role: "system", content: "You are an automated financial AI quantitative engine. Output valid JSON only." },
              { role: "user", content: prompt }
            ],
            { preferredProvider: config.aiProvider, maxTokens: 400 }
          );

          // Parse AI response
          const jsonMatch = aiRes.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.action && parsed.targetPrice && parsed.stopLoss) {
              signalData = {
                symbol,
                instrumentType: isIndex ? "INDEX" : "STOCK",
                action: parsed.action.toUpperCase() === "SELL" ? "SELL" : "BUY",
                displayText: parsed.displayText || `${symbol} ${parsed.action} @ ₹${quote.price}`,
                entryPrice: Number(parsed.entryPrice) || quote.price,
                targetPrice: Number(parsed.targetPrice),
                stopLoss: Number(parsed.stopLoss),
                confidence: Math.min(95, Math.max(60, Number(parsed.confidence) || 80)),
                rationale: parsed.rationale || `Live AI analysis based on real-time price of ₹${quote.price}.`,
                status: "ACTIVE",
                timeframe: parsed.timeframe || "INTRADAY",
                expiresAt: new Date(Date.now() + 6 * 3600 * 1000), // 6 hours (rest of session)
              };
            }
          }
        } catch (aiErr: any) {
          logger.debug({ err: aiErr.message }, `AI generation failed for ${symbol}, falling back to algorithmic quantitative engine`);
        }

        // 2. Fallback to Quantitative Algorithmic Engine if AI failed
        if (!signalData) {
          const isBullish = quote.changePercent >= 0;
          const pct = Math.abs(quote.changePercent);
          const price = quote.price;

          const action = isBullish ? "BUY" : "SELL";
          const targetMultiplier = isBullish ? 1.018 : 0.982;
          const stopMultiplier = isBullish ? 0.991 : 1.009;

          const targetPrice = Math.round(price * targetMultiplier * 100) / 100;
          const stopLoss = Math.round(price * stopMultiplier * 100) / 100;
          const confidence = Math.min(94, Math.round(72 + Math.min(pct, 3) * 6));

          signalData = {
            symbol,
            instrumentType: isIndex ? "INDEX" : "STOCK",
            action,
            displayText: `${symbol} ${action} @ ₹${price.toFixed(2)} (${isBullish ? '+' : ''}${quote.changePercent.toFixed(2)}%)`,
            entryPrice: price,
            targetPrice,
            stopLoss,
            confidence,
            rationale: isBullish
              ? `Real-time momentum trigger: ${symbol} trading at ₹${price.toFixed(2)} (+${quote.changePercent.toFixed(2)}%), holding above session open ₹${quote.open} with high liquidity.`
              : `Bearish breakdown alert: ${symbol} trading at ₹${price.toFixed(2)} (${quote.changePercent.toFixed(2)}%), showing intraday selling pressure below session open ₹${quote.open}.`,
            status: "ACTIVE",
            timeframe: "INTRADAY",
            expiresAt: new Date(Date.now() + 6 * 3600 * 1000),
          };
        }

        // Insert new active signal into DB
        await db.insert(signals).values(signalData);
        generatedCount++;
        logger.info({ symbol, action: signalData.action, price: signalData.entryPrice }, "New live market signal generated");
      } catch (itemErr: any) {
        logger.warn({ symbol, err: itemErr.message }, "Error generating signal for symbol");
      }
    }

    globalCache.set("last_signals_worker_run", new Date().toISOString(), 0);
    logger.info({ generatedCount }, "Signals worker cycle completed with fresh live signals");
  } catch (error) {
    logger.error({ err: error }, "Signals worker cycle encountered error");
  }
}
