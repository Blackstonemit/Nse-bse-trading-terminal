<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19.2" />
  <img src="https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.1-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Electron-35-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron 35" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5.9" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">🏦 NSE/BSE AI Trading Terminal</h1>

<p align="center">
  <strong>A professional-grade, multi-threaded quantitative trading workstation</strong><br/>
  Real-time Indian stock market data • Autonomous AI subagent workers • Multi-timeframe scalping<br/>
  Options analytics • Fundamental analysis • Portable Windows desktop executable
</p>

---

## ✨ Feature Matrix

| Module | Capabilities |
| :--- | :--- |
| **Live Ticker Ribbon** | Real-time streaming top indices ticker (NIFTY, BANKNIFTY, SENSEX, GIFT Nifty, VIX, Crude) with live market hours status |
| **Categorized Top Navbar** | MarketEasy-style header navigation with megamenus for Markets, Derivatives, AI Trading, Commodities, and Tools |
| **Conviction Picks** | Analyst consensus price targets, upside projections (>20%–50%), broker buy ratings, and fundamental thesis |
| **Live OI Tracker** | Strike-by-strike Call/Put OI distribution, Max Pain settlement pin, Put-Call Ratio (PCR), and Gamma Blast alerts |
| **Volume Shockers** | Real-time screener for abnormal volume surges (>2x to 5x 20DMA) with delivery participation and breakout signals |
| **IPO Watch & GMP** | Mainline & SME IPO tracker with live Grey Market Premium (GMP), expected listing gains, lot sizes, and subscription |
| **Commodities Desk** | Live 24K/22K Gold rates per 10g across Indian cities, 1 Kg Silver spot, and MCX Crude/Natural Gas/Metals contracts |
| **AI Trading Copilot** | Dedicated conversational AI trading desk with prompt presets, multi-provider failover, and chat session persistence |
| **Mutual Funds Explorer** | Top funds across Large, Mid, Small, and Flexi Cap categories with 1Y/3Y/5Y CAGR returns, NAVs, and portfolio holdings |
| **Live Dashboard** | Real-time quotes for NIFTY 50, BANKNIFTY, SENSEX, GIFT Nifty · Top Gainers/Losers · Market Heatmaps |
| **Custom Workspace** | Drag-and-drop widget layout engine for personalized multi-monitor trader setups |
| **Multibagger Screener** | Discover 10x–100x compounding stocks (ROE > 20%, low debt, high-volume breakouts, custom sliders) |
| **Penny Stock Screener** | Micro-cap turnaround screener filtering growth stocks under ₹100 and market cap < ₹150 Cr |
| **Nifty Sectors & Indices** | Live sector rotation tracking, breadth analysis, and index constituent performance tables |
| **Signals Board** | Automated AI-generated BUY/SELL/EXIT signals with entry, target, stop-loss, and confidence scores |
| **5-Minute Scalper** | Real-time 5M scalping desk with order-book depth, VWAP bands, and momentum oscillators |
| **Paper Trading** | Virtual paper trading simulation with execution logs, performance analytics, and live P&L |
| **Global Exchange** | Real-time global macro indices (S&P 500, Nasdaq, GIFT Nifty, Crude Oil, DXY) for sentiment |
| **Market Feed** | Live streaming quotes with bid/ask spreads and tick-by-tick data for tracked instruments |
| **Order Flow** | Institutional order flow analysis, bulk deal detection, and delivery volume tracking |
| **Options Chain** | Real-time Open Interest tracking, IV surface, Greeks, and multi-strike comparison |
| **Strategy Builder** | Multi-leg option strategy builder (Bull Call, Iron Condor, Straddle) with P&L payoff charts |
| **Futures Feed** | Real-time Spot vs Futures basis tracking, rollover analysis, and premium/discount alerts |
| **Technical Analysis** | 14+ indicator sweeps (RSI, MACD, Bollinger, MAs, VWAP) across 5m to 1d timeframes |
| **Fundamental Analysis** | Deep-dive valuation models, enterprise value, quarterly earnings charting, AI investment thesis |
| **Market News** | Aggregated financial news with sentiment scoring and bullish/bearish classification |
| **Interactive Charts** | TradingView-powered Lightweight Charts with multi-timeframe candlestick and line overlays |
| **Backtesting Engine** | Historical strategy backtesting with configurable parameters, equity curves, and drawdown metrics |
| **Bhavcopy Analyzer** | Upload and analyze daily NSE Bhavcopy archives for institutional bulk deals and delivery % |
| **Watchlist** | Custom stock watchlists with real-time price alerts and change tracking |
| **Settings** | Multi-provider AI key management, theme customization (Dark/Light/Emerald/Amber/Violet), and app config |
| **Desktop App** | Self-contained, portable Windows executable (`TradingTerminal.exe`) via Electron 35 |
| **MCP Server** | 22-tool Model Context Protocol server for AI agent integration with trading data |

---

## 🤖 Autonomous AI Worker Subagents

The workstation runs **6 asynchronous background worker subagents** in Node.js background threads. These perform heavy quantitative sweeps without blocking user interaction:

| Worker | Schedule | Description |
| :--- | :--- | :--- |
| 🟢 **Signals Worker** | Every 15 min | Scans market movers and breakout setups to publish automated trade signals |
| 🚀 **Multibagger Worker** | Every 30 min | Runs financial health and compounding algorithms across equity catalogs |
| 🪙 **Penny Stock Worker** | Every 30 min | Evaluates turnaround balance sheets and sales growth metrics for micro-caps |
| 🌐 **Global Market Worker** | Every 10 min | Tracks global commodity prices and macro index futures for sentiment alignment |
| 📊 **Fundamental Worker** | Every 60 min | Generates automated valuation profiles and financial statement summaries |
| 📈 **Technical Worker** | Every 15 min | Monitors technical indicator crossovers and volatility band triggers |

---

## ⚙️ Multi-Provider AI Engine

The terminal features a resilient multi-provider AI engine with automatic failover routing based on latency and availability:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Request Pipeline                       │
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐ │
│  │ NVIDIA   │──▶│ Gemini   │──▶│ DeepSeek │──▶│ Local   │ │
│  │ NIM      │   │ Pro      │   │ Reasoner │   │ Ollama  │ │
│  │ ~120ms   │   │ ~180ms   │   │ ~220ms   │   │ Offline │ │
│  └──────────┘   └──────────┘   └──────────┘   └─────────┘ │
│       ▲               ▲              ▲             ▲       │
│       └───────── Automatic Failover Chain ─────────┘       │
└─────────────────────────────────────────────────────────────┘
```

| Provider | Model | Latency | Use Case |
| :--- | :--- | :--- | :--- |
| **NVIDIA NIM** | `meta/llama-3.3-70b-instruct` | ~120ms | Fast inference, signal generation |
| **Google Gemini** | `gemini-2.5-pro` | ~180ms | Deep reasoning, fundamental analysis |
| **DeepSeek** | `deepseek-reasoner` | ~220ms | Quantitative analytics |
| **Local / Ollama** | Configurable | Variable | 100% offline fallback |

---

## 🏗️ Architecture

```
nse-bse-trading-terminal/
│
├── artifacts/
│   ├── api-server/            # Express 5 REST API + 6 autonomous worker subagents
│   │   ├── src/routes/        # 12 API route modules (market, signals, options, etc.)
│   │   ├── src/workers/       # Background worker threads (signals, screener, technical)
│   │   └── src/lib/           # Multi-AI engine, caching, Yahoo Finance client
│   │
│   ├── market-dashboard/      # React 19 + Vite 7 + Tailwind CSS 4 frontend
│   │   ├── src/pages/         # 25 full-featured trading pages
│   │   ├── src/components/    # Reusable UI component library (ShadCN + custom)
│   │   └── src/hooks/         # React hooks (auth, queries, theme)
│   │
│   ├── desktop-app/           # Electron 35 desktop shell with native builds
│   │   └── main.js            # Electron main process + embedded server
│   │
│   └── mcp-server/            # Model Context Protocol server (22 trading tools)
│       └── src/               # Tool definitions for AI agent integration
│
├── lib/
│   ├── db/                    # Drizzle ORM + libSQL/SQLite database layer
│   │   └── src/schema/        # 6 table schemas (signals, quotes, settings, etc.)
│   │
│   ├── api-zod/               # Zod validation schemas (auto-generated)
│   ├── api-spec/              # OpenAPI specification + Orval codegen
│   └── api-client-react/      # Generated TanStack React Query hooks
│
├── scripts/                   # Build utilities and dev tooling
├── dist-portable/             # Compiled Windows executable output
└── pnpm-workspace.yaml        # Monorepo config with dependency catalog
```

---

## 🛠️ Technology Stack

### Frontend
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| React | 19.2.7 | UI framework with concurrent rendering |
| Vite | 7.3 | Build tool with HMR |
| Tailwind CSS | 4.1 | Utility-first styling with custom dark theme |
| Framer Motion | 12.42 | Micro-animations and transitions |
| TanStack Query | 5.101 | Server state management and caching |
| Recharts | 3.9 | Charting library for financial data |
| Lightweight Charts | 5.2 | TradingView candlestick and line charts |
| Lucide React | 1.24 | Icon library |
| Wouter | 3.3 | Lightweight client-side routing |
| ShadCN/UI + Radix | Latest | Accessible component primitives |

### Backend
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| Express | 5.x | HTTP server with async middleware |
| Drizzle ORM | 0.45 | Type-safe SQL query builder |
| libSQL/SQLite | 0.14 | Embedded trading database |
| Yahoo Finance | 4.0 | Market data provider |
| Pino | 9.x | Structured JSON logging |
| OpenAI SDK | 6.x | GPT API client |
| Anthropic SDK | 0.92 | Claude API client |

### Desktop & Tooling
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| Electron | 35.x | Native desktop shell |
| electron-builder | 25.x | Windows installer/portable builds |
| TypeScript | 5.9 | Type safety across entire monorepo |
| pnpm | 11.x | Fast, disk-efficient package manager |
| esbuild | 0.27 | Backend bundler |
| Vitest | 4.1 | Unit and integration testing |
| MCP SDK | 1.13 | Model Context Protocol server |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 20 LTS
- **pnpm** ≥ 10

### 1. Clone & Install

```powershell
git clone https://github.com/Blackstonemit/Nse-bse-trading-terminal.git
cd nse-bse-trading-terminal
pnpm install
```

### 2. Run Development Servers

```powershell
# Terminal 1 — Start API Server + Worker Subagents (port 3001)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Start Frontend Dashboard (port 5173)
pnpm --filter @workspace/market-dashboard run dev
```

Open **http://localhost:5173** (dev) or **http://localhost:8080** (production/Electron).

### 3. Build for Production

```powershell
# Full workspace build (typecheck + compile all packages)
pnpm run build

# Build portable desktop executable
pnpm run build:desktop
```

The compiled executable is output to `dist-portable/win-unpacked/TradingTerminal.exe`.

### 4. One-Click Scripts (Windows)

| Script | Purpose |
| :--- | :--- |
| `install.bat` | Install Node.js + pnpm + all dependencies |
| `start.bat` | Launch API server + dashboard in parallel |
| `build-standalone.bat` | Compile portable `.exe` |
| `uninstall.bat` | Clean up dependencies and build artifacts |

---

## 🔧 Configuration

### AI Provider Keys

Navigate to **Settings → AI Providers** in the dashboard to configure:
- NVIDIA NIM API Key
- Google Gemini API Key
- DeepSeek API Key
- Custom base URLs for self-hosted models

### Theme Customization

The terminal supports 5 theme variants:
- 🌑 **Dark** (default) — Professional trader terminal aesthetic
- ☀️ **Light** — Clean light mode
- 💚 **Emerald** — Green accent theme
- 🟡 **Amber** — Gold accent theme
- 💜 **Violet** — Purple accent theme

---

## 🧪 Testing

```powershell
# Run API server unit tests (sequential to avoid SQLite locking)
pnpm --filter @workspace/api-server test -- --sequence.concurrent=false

# TypeScript type checking
pnpm run typecheck

# Full build verification
pnpm run build
```

---

## 📁 MCP Server Integration

The terminal includes a **Model Context Protocol (MCP) server** exposing 22 trading tools for AI agent integration:

```json
{
  "mcpServers": {
    "trading-terminal": {
      "command": "node",
      "args": ["./artifacts/mcp-server/dist/index.js"]
    }
  }
}
```

Available tools include: `get_market_quotes`, `get_trading_signals`, `get_options_chain`, `get_stock_fundamentals`, `run_technical_analysis`, `search_stocks`, and more.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 🙏 Acknowledgements

Built with:
- [TradingView Lightweight Charts](https://github.com/nicegui/lightweight-charts) — Financial charting
- [Recharts](https://recharts.org) — React charting library
- [ShadCN/UI](https://ui.shadcn.com) — Component primitives
- [Drizzle ORM](https://orm.drizzle.team) — Type-safe database layer
- [Yahoo Finance](https://github.com/nicegui/yahoo-finance2) — Market data
- [Tailwind CSS](https://tailwindcss.com) — Utility-first CSS
- [Electron](https://electronjs.org) — Desktop application framework
