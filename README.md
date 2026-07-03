# 🏦 NSE/BSE AI Trading Terminal Workstation

![Version](https://img.shields.io/badge/version-1.4.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/electron-v34.5.8-9cf)
![Build](https://img.shields.io/badge/build-passing-brightgreen)

> **A premium, multi-threaded quantitative trading workstation** delivering real-time Indian stock market data, autonomous AI worker subagents, multi-timeframe scalping, options analytics, fundamental analysis, and portable desktop executables.

---

## ✨ Feature Matrix

| Module | Feature Capabilities |
| :--- | :--- |
| **Live Dashboard** | Real-time quotes for NIFTY 50, BANKNIFTY, SENSEX, GIFT Nifty, Top Gainers/Losers, and Market Heatmaps |
| **Multibagger Screener** | Discover 10x-100x compounding stocks (ROE > 20%, low debt, high volume breakouts, custom sliders) |
| **Penny Stock Screener** | Micro-cap turnaround screener filtering growth stocks under ₹100 and market cap < ₹150 Cr |
| **Signals Board & 5M Scalper** | Automated AI-generated BUY/SELL/EXIT trading signals with entry, target, stop-loss, and 5M scalping desk |
| **Fundamental Analysis** | Deep-dive valuation models, enterprise value, quarterly earnings charting, and AI investment thesis |
| **Technical Analysis Desk** | 14+ technical indicator sweeps (RSI, MACD, Bollinger Bands, Moving Averages, VWAP) across 5m to 1d charts |
| **Futures Feed & Options Chain** | Real-time Spot vs Futures basis, Open Interest (OI) tracking, and multi-leg Option strategy builder |
| **Global Exchange** | Real-time tracking of global macro indices (S&P 500, Nasdaq, GIFT Nifty, Crude Oil, DXY) for sentiment calculation |
| **Paper Trading Desk** | Virtual paper trading simulation portfolio with execution logs, performance analytics, and live P&L |
| **Bhavcopy Analyzer** | Upload and analyze daily NSE Bhavcopy archives for institutional bulk deals and delivery percentages |
| **Custom Workspace** | Drag-and-drop widget layout engine for personalized multi-monitor trader setups |
| **Desktop Executable** | Self-contained, portable Windows application executable (`TradingTerminal.exe`) |

---

## 🤖 Autonomous AI Worker Subagents

The workstation includes **6 asynchronous background worker subagents** running in Node.js background threads to perform heavy quantitative sweeps without blocking user interaction:

- 🟢 **Signals Subagent (`signalsWorker.ts`)**: Scans market movers and breakout setups every 15 minutes to publish automated trade signals.
- 🚀 **Multibagger Subagent (`screenerWorker.ts`)**: Runs financial health and compounding algorithms across equity catalogs.
- 🪙 **Penny Stock Subagent (`pennyWorker.ts`)**: Evaluates turnaround balance sheets and sales growth metrics for micro-caps.
- 🌐 **Global Market Subagent (`globalMarketWorker.ts`)**: Tracks global commodity prices and macro index futures for GIFT Nifty sentiment alignment.
- 📊 **Fundamental Subagent (`fundamentalWorker.ts`)**: Generates automated valuation profiles and financial statement summaries.
- 📈 **Technical Subagent (`technicalWorker.ts`)**: Monitors technical indicator cross-overs and volatility bands.

---

## ⚙️ AI Engine & Auto-Fallback Pipeline

The terminal features a resilient multi-provider AI engine that automatically route requests based on latency and availability:

1. **NVIDIA NIM (Primary Fast Inference)**: `meta/llama-3.3-70b-instruct` (~120ms latency)
2. **Google Gemini (Deep Reasoning)**: `gemini-2.5-pro` (~180ms latency)
3. **DeepSeek AI (Quantitative Analytics)**: `deepseek-reasoner` (~220ms latency)
4. **OpenModel & Local AI Fallback**: Local FastAPI server (`fcc-server` port 8082) or Ollama for 100% offline functionality.

---

## 🛠️ Architecture & Technology Stack

```text
/
├── artifacts/
│   ├── api-server/          # Express REST API & Autonomous Worker Subagents (Node.js ESM)
│   ├── market-dashboard/    # React 18 + Vite 7 Frontend UI (Tailwind CSS v4, Lucide Icons)
│   └── desktop-app/         # Electron 34 desktop shell wrapper
├── lib/
│   ├── db/                  # Drizzle ORM + Local SQLite Trading Database
│   ├── api-spec/            # OpenAPI schemas & codegen specifications
│   └── api-client-react/    # Generated TanStack React Query hooks
├── dist-portable/          # Compiled portable production workstation (`TradingTerminal.exe`)
└── pnpm-workspace.yaml      # Monorepo configuration
```

---

## 🚀 Quick Start & Desktop Build

### Prerequisites
- **Node.js**: v20+ (LTS recommended)
- **pnpm**: v10+

### 1️⃣ Clone and Install
```powershell
git clone <your-repository-url>
cd nse-bse-trading-terminal
pnpm install
```

### 2️⃣ Run Development Services
Launch the API server and frontend workstation in parallel:

```powershell
# Start Backend API Server & Worker Subagents (Port 3001)
pnpm --filter @workspace/api-server run dev

# Start Frontend Workstation UI (Port 5173)
pnpm --filter @workspace/market-dashboard run dev
```

### 3️⃣ Build Portable Desktop Application
To compile the standalone desktop application executable (`TradingTerminal.exe`):

```powershell
pnpm run build:desktop
```
The compiled executable will be generated at `dist-portable/win-unpacked/TradingTerminal.exe`.

---

## 📄 License & Acknowledgements

- **License**: MIT License.
- **Data & Libraries**: Powered by **Lightweight Charts (TradingView)**, **Recharts**, **Express**, **Drizzle ORM**, **Tailwind CSS**, and **Yahoo Finance**.
