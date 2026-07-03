import { Router } from "express";
import { db, conversations, messages, watchlist, trades } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getProviderKey, AIProvider } from "../lib/multi-ai";
import { getLivePrice, toYahooSymbol } from "./paper-trading";
import { computeTechnicals } from "./analysis";
import OpenAI from "openai";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "trading-terminal-secret-key-change-me";

// ── GET /conversations ────────────────────────────────────────────────────────
router.get("/conversations", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const items = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));

    res.json(items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString()
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch conversations");
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// ── POST /conversations ───────────────────────────────────────────────────────
router.post("/conversations", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const { title = "New Chat" } = req.body;
    const [item] = await db
      .insert(conversations)
      .values({ userId, title })
      .returning();

    res.status(201).json({
      ...item,
      createdAt: item.createdAt.toISOString()
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// ── DELETE /conversations/:id ─────────────────────────────────────────────────
router.delete("/conversations/:id", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// ── GET /conversations/:id/messages ──────────────────────────────────────────
router.get("/conversations/:id/messages", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    
    // Security check: ensure conversation belongs to user
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const items = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    res.json(items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString()
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch messages");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ── TOOLS DEFINITIONS ────────────────────────────────────────────────────────
const COPILOT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_market_quote",
      description: "Get the current live stock price/quote for a specific NSE/BSE symbol (e.g. RELIANCE, TCS, NIFTY).",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock ticker symbol, e.g. RELIANCE, INFY, TCS." }
        },
        required: ["symbol"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_watchlist",
      description: "Retrieve all stock symbols currently in the user's personal watchlist.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "add_to_watchlist",
      description: "Add a stock symbol to the user's watchlist.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Ticker symbol, e.g. INFY, SBIN." },
          name: { type: "string", description: "Company name, e.g. Infosys Ltd." }
        },
        required: ["symbol", "name"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "place_paper_trade",
      description: "Execute a simulated paper trade (BUY/SELL) for a specific symbol at current market price.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Symbol to trade, e.g. TCS, RELIANCE." },
          action: { type: "string", enum: ["BUY", "SELL"], description: "Trade action." },
          quantity: { type: "integer", description: "Number of shares to trade." }
        },
        required: ["symbol", "action", "quantity"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_technical_analysis",
      description: "Calculate technical indicators (RSI, MACD, Moving Averages, trend, signal strength) for a symbol.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Symbol to analyze." }
        },
        required: ["symbol"]
      }
    }
  }
];

// ── POST /conversations/:id/chat ─────────────────────────────────────────────
router.post("/conversations/:id/chat", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const conversationId = Number(req.params.id);
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    // Security check: ensure conversation belongs to user
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // 1. Save user's message
    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: content.trim(),
    });

    // 2. Load recent message history for context
    const previousMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // Limit context length (last 15 messages)
    const recentThread = previousMessages.slice(-15);

    // 3. Resolve preferred AI provider and client
    const preferredOrder: AIProvider[] = ["deepseek", "openai", "gemini", "gemma", "nvidia", "claude", "ollama"];
    let activeProvider: AIProvider | null = null;
    let apiKey: string | null = null;

    for (const p of preferredOrder) {
      const key = await getProviderKey(p, userId);
      if (key) {
        activeProvider = p;
        apiKey = key;
        break;
      }
    }

    if (!activeProvider || !apiKey) {
      // Create a default local rule-based response if no keys are found
      const [savedAssis] = await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: "I'm ready to assist, but I couldn't find any active AI Provider API Keys configured. Please go to the **Settings** page and add your API keys (DeepSeek, OpenAI, Gemini, Gemma, Claude, or NVIDIA) to enable full copilot intelligence.",
      }).returning();
      
      res.json({
        message: {
          ...savedAssis,
          createdAt: savedAssis.createdAt.toISOString()
        },
        executedTools: []
      });
      return;
    }

    // 4. Run standard OpenAI-compatible tool loop
    const systemPrompt = `You are an advanced Indian stock market AI Copilot. You assist traders with NSE/BSE stocks, technical analysis, watchlists, and paper-trading execution. 
    You have direct tools to check live prices, view/add watchlists, perform technical calculations, and place simulated paper trades. 
    Always provide helpful, well-reasoned analyses and confirm actions (like watchlists or trades) clearly. Use tables and markdown formatting for rich visuals.`;

    const formattedMessages = [
      { role: "system" as const, content: systemPrompt },
      ...recentThread.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      }))
    ];

    let client: OpenAI;
    let modelName = "gpt-4o-mini";

    if (activeProvider === "deepseek") {
      client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com/v1" });
      modelName = "deepseek-chat";
    } else if (activeProvider === "gemini") {
      client = new OpenAI({ apiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" });
      modelName = "gemini-1.5-flash";
    } else if (activeProvider === "gemma") {
      client = new OpenAI({ apiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" });
      modelName = "gemma-4-31b-it";
    } else if (activeProvider === "nvidia") {
      client = new OpenAI({ apiKey, baseURL: "https://integrate.api.nvidia.com/v1" });
      modelName = process.env["NVIDIA_MODEL"] ?? "nvidia/nemotron-3-ultra-550b-a55b";
    } else if (activeProvider === "ollama") {
      let host = "http://localhost:11434";
      let model = "qwen2.5";
      try {
        const config = JSON.parse(apiKey);
        if (config.host) host = config.host;
        if (config.model) model = config.model;
      } catch {
        if (apiKey.includes("|")) {
          const [h, m] = apiKey.split("|");
          if (h) host = h;
          if (m) model = m;
        } else if (apiKey.startsWith("http")) {
          host = apiKey;
        }
      }
      const cleanHost = host.replace(/\/$/, "");
      client = new OpenAI({ apiKey: "ollama", baseURL: `${cleanHost}/v1` });
      modelName = model;
    } else {
      client = new OpenAI({ apiKey });
      modelName = "gpt-4o-mini";
    }

    const executedTools: Array<{ tool: string; args: any; result: any }> = [];

    // First completion call
    // For NVIDIA NIM Nemotron reasoning model, apply extra params
    const isNvidia = activeProvider === "nvidia";
    const nimExtras = isNvidia ? { temperature: 1, top_p: 0.95, max_tokens: 16384, reasoning_budget: 16384, chat_template_kwargs: { enable_thinking: true } } : {};
    const completion = await client.chat.completions.create({
      model: modelName,
      messages: formattedMessages as any,
      tools: COPILOT_TOOLS,
      tool_choice: "auto",
      ...nimExtras,
    } as any);

    let assistantMessage = completion.choices[0].message;
    
    // If the model wants to call tools, handle them in a loop
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolThread: any[] = [...formattedMessages, assistantMessage];

      for (const rawCall of assistantMessage.tool_calls) {
        const call = rawCall as any;
        const name = call.function.name;
        const args = JSON.parse(call.function.arguments);
        let result: any = null;

        try {
          if (name === "get_market_quote") {
            const price = await getLivePrice(args.symbol);
            result = { symbol: args.symbol, price };
          } else if (name === "get_watchlist") {
            const items = await db.select().from(watchlist).where(eq(watchlist.userId, userId));
            result = items.map(i => ({ symbol: i.symbol, name: i.name, exchange: i.exchange }));
          } else if (name === "add_to_watchlist") {
            const [item] = await db.insert(watchlist).values({
              userId,
              symbol: args.symbol.toUpperCase(),
              name: args.name,
            }).returning();
            result = { success: true, item };
          } else if (name === "place_paper_trade") {
            const price = await getLivePrice(args.symbol);
            if (price === 0) {
              result = { success: false, error: "Failed to resolve live price for symbol." };
            } else {
              const [trade] = await db.insert(trades).values({
                userId,
                symbol: args.symbol.toUpperCase(),
                action: args.action.toUpperCase() as "BUY" | "SELL",
                price,
                quantity: args.quantity,
                type: "SIGNAL",
              }).returning();
              result = { success: true, trade };
            }
          } else if (name === "get_technical_analysis") {
            const tech = await computeTechnicals(args.symbol.toUpperCase(), "15m");
            result = tech;
          }

          executedTools.push({ tool: name, args, result });
        } catch (toolErr: any) {
          result = { error: toolErr?.message || "Tool execution failed" };
        }

        // Push tool response into the model's message history
        toolThread.push({
          role: "tool",
          tool_call_id: call.id,
          name: name,
          content: JSON.stringify(result),
        });
      }

      // Second completion call to let model summarize the tool execution results
      const finalCompletion = await client.chat.completions.create({
        model: modelName,
        messages: toolThread as any,
        ...nimExtras,
      } as any);

      assistantMessage = finalCompletion.choices[0].message;
    }

    const finalContent = assistantMessage.content || "I have processed your request.";

    // 5. Save assistant's final response
    const [savedAssistantMsg] = await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: finalContent,
    }).returning();

    res.json({
      message: {
        ...savedAssistantMsg,
        createdAt: savedAssistantMsg.createdAt.toISOString()
      },
      executedTools
    });
  } catch (err) {
    req.log.error({ err }, "Error during copilot chat");
    res.status(500).json({ error: "Failed to run Copilot Chat loop" });
  }
});

export default router;
