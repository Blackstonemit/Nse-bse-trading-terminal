import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { signals } from "@workspace/db";
import { computeTechnicals } from "./analysis";
import { callWithFallback } from "../lib/multi-ai";

const router: IRouter = Router();

const STYLE_PROMPT: Record<string, string> = {
  conservative:
    "Prefer high-confidence, well-confirmed signals only. Use tight stop-losses and conservative targets. Require multiple indicator alignment before generating a signal. If confidence is below 65%, do not include the signal.",
  moderate:
    "Balance risk and reward. Include signals that have moderate confirmation. Standard stop-loss and target levels. Include signals with confidence above 50%.",
  aggressive:
    "Include all noteworthy signals even if early or less confirmed. Wider targets, higher risk tolerance. Active traders want more signals. Include signals with confidence above 35%.",
  committee:
    "Act as the Chief Synthesizer of a Trading Committee. Weigh inputs from technical, fundamental, and risk perspectives to output a highly refined, consensus-driven signal.",
};

router.post("/openai/agent/analyze", async (req, res) => {
  try {
    const {
      symbol,
      instrumentType = "STOCK",
      timeframe = "INTRADAY",
      numSignals = 2,
      maxTokens = 2048,
      style = "moderate",
      customContext = "",
      confidenceThreshold = 0,
      saveSignals: doSaveSignals = true,
      provider = "fallback",
      interval,
    } = req.body as {
      symbol: string;
      instrumentType?: string;
      timeframe?: string;
      numSignals?: number;
      maxTokens?: number;
      style?: string;
      customContext?: string;
      confidenceThreshold?: number;
      saveSignals?: boolean;
      provider?: string;
      interval?: string;
    };

    if (!symbol) {
      res.status(400).json({ error: "symbol is required" });
      return;
    }

    const clampedNumSignals = Math.min(5, Math.max(1, Number(numSignals) || 2));
    const clampedTokens = Math.min(4096, Math.max(512, Number(maxTokens) || 2048));
    const clampedThreshold = Math.min(90, Math.max(0, Number(confidenceThreshold) || 0));
    const styleKey = ["conservative", "moderate", "aggressive", "committee"].includes(style) ? style : "moderate";

    let techData: any = null;
    try {
      techData = await computeTechnicals(symbol.toUpperCase(), interval || (timeframe === "INTRADAY" ? "15m" : "1d"));
    } catch (err) {
      req.log.warn({ err, symbol }, "Could not fetch technical data");
    }

    const techContext = techData
      ? `Technical Indicators for ${symbol}:
- RSI (14): ${techData.rsi ?? "N/A"}
- MACD: ${techData.macd ? `${techData.macd.macd.toFixed(2)} | Signal: ${techData.macd.signal.toFixed(2)} | Histogram: ${techData.macd.histogram.toFixed(2)}` : "N/A"}
- Bollinger Bands: ${techData.bollingerBands ? `Upper: ${techData.bollingerBands.upper} | Middle: ${techData.bollingerBands.middle} | Lower: ${techData.bollingerBands.lower}` : "N/A"}
- SMA 20/50/200: ${techData.sma20 ?? "N/A"} / ${techData.sma50 ?? "N/A"} / ${techData.sma200 ?? "N/A"}
- EMA 9/21: ${techData.ema9 ?? "N/A"} / ${techData.ema21 ?? "N/A"}
- ATR (14): ${techData.atr ?? "N/A"}
- Stochastic K/D: ${techData.stochastic ? `${techData.stochastic.k} / ${techData.stochastic.d}` : "N/A"}
- Computed Trend: ${techData.trend}
- Overall Signal: ${techData.overallSignal} (Strength: ${techData.signalStrength}%)`
      : `No technical data available for ${symbol}.`;

    const styleInstruction = STYLE_PROMPT[styleKey];

    const systemPrompt = `You are an elite Indian stock market analyst with deep expertise in NSE/BSE trading, technical analysis, and derivatives (options and futures). You analyze stocks, index options (NIFTY/BANKNIFTY), and futures. You provide precise, actionable signals with clear entry, target, and stop-loss levels.

Trading Style: ${styleKey.toUpperCase()} — ${styleInstruction}

IMPORTANT: Respond ONLY with valid JSON. No markdown fences, no explanations outside JSON.`;

    const customSection = customContext?.trim()
      ? `\n\nAdditional context from the user:\n${customContext.trim()}`
      : "";

    const userPrompt = `Perform a comprehensive technical analysis for ${symbol} (${instrumentType}) with ${timeframe} timeframe.

${techContext}${customSection}

Generate exactly ${clampedNumSignals} signal(s) that reflect a ${styleKey} trading approach.

Respond with this exact JSON structure:
{
  "summary": "2-3 sentence technical analysis summary",
  "keyLevels": {
    "support": [level1, level2, level3],
    "resistance": [level1, level2, level3]
  },
  "signals": [
    {
      "action": "BUY" | "SELL" | "EXIT",
      "instrumentType": "${instrumentType}",
      "displayText": "clear signal text e.g. BUY NIFTY 22000 CE or SELL RELIANCE @ 2850",
      "entryPrice": number or null,
      "targetPrice": number or null,
      "stopLoss": number or null,
      "confidence": 0-100,
      "rationale": "concise 1-sentence rationale"
    }
  ],
  "riskAssessment": "1-2 sentences on risk assessment and position sizing advice"
}

If ${instrumentType} is OPTIONS, suggest specific strike prices and expiries. Only include signals with confidence >= ${clampedThreshold}.`;

    let analysisResult: any;
    let usedProvider = "local-rule-engine";

    try {
      if (styleKey === "committee") {
        const [techRes, riskRes] = await Promise.all([
          callWithFallback([
            { role: "system", content: "You are a Technical Analyst. Analyze the indicators and suggest a trade direction." },
            { role: "user", content: `Technical data for ${symbol}:\n${techContext}` }
          ], { maxTokens: 500, preferredProvider: provider }),
          callWithFallback([
            { role: "system", content: "You are a Risk Manager. Focus on stop-losses, risk/reward ratios, and market volatility." },
            { role: "user", content: `Risk analysis for ${symbol} given technicals:\n${techContext}` }
          ], { maxTokens: 500, preferredProvider: provider })
        ]);

        const synthPrompt = `You are the Synthesizer for the Trading Committee. 
Here is the Technical Analyst's view:
${techRes.content}

Here is the Risk Manager's view:
${riskRes.content}

${userPrompt}`;

        const completion = await callWithFallback(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: synthPrompt },
          ],
          { maxTokens: clampedTokens, preferredProvider: provider }
        );
        const content = completion.content;
        usedProvider = completion.provider;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysisResult = JSON.parse(jsonMatch?.[0] ?? content);
      } else {
        const completion = await callWithFallback(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          { maxTokens: clampedTokens, preferredProvider: provider }
        );
        const content = completion.content;
        usedProvider = completion.provider;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysisResult = JSON.parse(jsonMatch?.[0] ?? content);
      }
    } catch (err) {
      req.log.warn({ err }, "All AI providers failed. Falling back to Local Rule Engine.");
      
      const overall = techData?.overallSignal || "HOLD";
      const trendText = techData?.trend ? techData.trend.replace("_", " ").toLowerCase() : "neutral";
      
      let summary = `Technical indicators for ${symbol.toUpperCase()} exhibit a ${trendText} market posture. `;
      if (overall === "BUY") {
        summary += `The asset is displaying upward momentum supported by moving averages and a positive MACD structure. Consider establishing long positions near key support levels.`;
      } else if (overall === "SELL") {
        summary += `The asset is showing downward momentum under bearish pressure, with key moving averages acting as overhead resistance. Consider short positions or exiting longs.`;
      } else {
        summary += `The price action is consolidating with neutral momentum. Moving averages and RSI suggest a range-bound market. Recommend waiting for a clear breakout.`;
      }

      const currentPrice = techData?.sma20 ?? 100;
      const atrVal = techData?.atr ?? (currentPrice * 0.02);
      
      const support = [
        Math.round((techData?.bollingerBands?.lower || (currentPrice - atrVal)) * 100) / 100,
        Math.round((currentPrice - 2 * atrVal) * 100) / 100,
        Math.round((currentPrice - 3 * atrVal) * 100) / 100,
      ];
      
      const resistance = [
        Math.round((techData?.bollingerBands?.upper || (currentPrice + atrVal)) * 100) / 100,
        Math.round((currentPrice + 2 * atrVal) * 100) / 100,
        Math.round((currentPrice + 3 * atrVal) * 100) / 100,
      ];

      const action = overall === "HOLD" ? "EXIT" : overall;
      const confidence = techData?.signalStrength || 50;
      
      let displayText = `${action} ${symbol.toUpperCase()} @ ${currentPrice.toFixed(2)}`;
      let entryPrice = currentPrice;
      let targetPrice = action === "BUY" ? currentPrice + 2.5 * atrVal : currentPrice - 2.5 * atrVal;
      let stopLoss = action === "BUY" ? currentPrice - 1.5 * atrVal : currentPrice + 1.5 * atrVal;
      
      if (action === "EXIT") {
        displayText = `EXIT POSITIONS ON ${symbol.toUpperCase()}`;
        entryPrice = null;
        targetPrice = null;
        stopLoss = null;
      } else {
        entryPrice = Math.round(entryPrice * 100) / 100;
        targetPrice = Math.round(targetPrice * 100) / 100;
        stopLoss = Math.round(stopLoss * 100) / 100;
      }

      const fallbackSignals = [];
      if (confidence >= clampedThreshold) {
        fallbackSignals.push({
          action,
          instrumentType,
          displayText,
          entryPrice,
          targetPrice,
          stopLoss,
          confidence,
          rationale: `Rule-based technical analysis due to ${trendText} trend and signal strength of ${confidence}%.`,
        });
      }

      analysisResult = {
        summary,
        keyLevels: {
          support,
          resistance,
        },
        signals: fallbackSignals,
        riskAssessment: `Maintain strict risk controls. Use a risk-reward ratio of 1:1.5 or better and adjust position sizing based on historical ATR volatility.`,
      };
    }

    const rawSignals: any[] = analysisResult.signals ?? [];
    const filteredSignals = rawSignals.filter(
      (s) => (s.confidence ?? 0) >= clampedThreshold
    );

    const savedSignals = [];
    if (doSaveSignals) {
      const now = new Date();
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(now.getTime() + istOffsetMs);
      let expiresAt: Date;
      if (timeframe === "INTRADAY") {
        expiresAt = new Date(Date.UTC(
          nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 10, 0, 0, 0
        ));
        if (expiresAt <= now) {
          expiresAt = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
          const day = expiresAt.getUTCDay();
          if (day === 6) expiresAt = new Date(expiresAt.getTime() + 2 * 24 * 60 * 60 * 1000);
          else if (day === 0) expiresAt = new Date(expiresAt.getTime() + 1 * 24 * 60 * 60 * 1000);
        }
      } else if (timeframe === "SWING") {
        expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      for (const sig of filteredSignals) {
        try {
          const [saved] = await db
            .insert(signals)
            .values({
              symbol: symbol.toUpperCase(),
              instrumentType: sig.instrumentType || instrumentType,
              action: sig.action,
              displayText: sig.displayText,
              entryPrice: sig.entryPrice ?? null,
              targetPrice: sig.targetPrice ?? null,
              stopLoss: sig.stopLoss ?? null,
              confidence: Math.min(100, Math.max(0, sig.confidence ?? 50)),
              rationale: sig.rationale || "",
              status: "ACTIVE",
              timeframe,
              expiresAt,
            })
            .returning();

          savedSignals.push({
            ...saved,
            createdAt: saved.createdAt.toISOString(),
            expiresAt: saved.expiresAt?.toISOString() ?? null,
          });
        } catch {
          // Skip if signal save fails
        }
      }
    }

    res.json({
      symbol: symbol.toUpperCase(),
      summary: analysisResult.summary ?? "",
      keyLevels: analysisResult.keyLevels ?? { support: [], resistance: [] },
      signals: doSaveSignals ? savedSignals : filteredSignals.map((s) => ({
        ...s,
        confidence: Math.min(100, Math.max(0, s.confidence ?? 50)),
      })),
      riskAssessment: analysisResult.riskAssessment ?? "",
      generatedAt: new Date().toISOString(),
      meta: {
        style: styleKey,
        timeframe,
        instrumentType,
        numRequested: clampedNumSignals,
        numGenerated: rawSignals.length,
        numAfterFilter: filteredSignals.length,
        confidenceThreshold: clampedThreshold,
        savedToDb: doSaveSignals,
        provider: usedProvider,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to run agent analysis");
    res.status(500).json({ error: "Failed to run agent analysis" });
  }
});

export default router;
