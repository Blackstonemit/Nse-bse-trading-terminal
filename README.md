# 🏦 NSE/BSE AI Trading Signals Terminal

![Version](https://img.shields.io/badge/version-1.3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![CI](https://img.shields.io/github/actions/workflow/status/yourrepo/ci.yml?branch=main)

> **A premium full‑stack trading terminal** delivering real‑time Indian market data, AI‑powered buy/sell signals, options analytics, backtesting, and Bhavcopy insights.

## ✨ Overview

| Feature | Description |
|---|---|
| **Live Dashboard** | Real‑time index quotes (NIFTY, BANKNIFTY, SENSEX), top gainers/losers, market movers |
| **Signals Board** | AI‑generated BUY/SELL/EXIT signals with confidence scores, entry, target, stop‑loss |
| **Market Feed** | Live quotes for NSE/BSE stocks with auto‑refresh during market hours |
| **Options Chain** | Live NSE options data → Yahoo Finance fallback → Synthetic data, with OI, IV, bid/ask |
| **Futures** | Simulated futures contracts (NIFTY, BANKNIFTY, RELIANCE, TCS, INFY) with basis & OI |
| **Technical Analysis** | RSI, MACD, SMA, EMA, Bollinger Bands, ATR, Stochastic (computed server‑side) |
| **Charts** | Interactive candlestick / line / area charts (lightweight‑charts) with overlay indicators |
| **Backtest** | Options strategy backtester using Black‑Scholes + historical Yahoo Finance price data |
| **Bhavcopy Analyzer** | Upload and analyse NSE daily Bhavcopy ZIP/CSV — gainers, losers, delivery % and bulk‑deal analysis |
| **Watchlist** | Persist your own symbol watchlist with live price quotes |
| **Settings** | Configure AI providers (NVIDIA, OpenAI, Anthropic, Gemini) and chart defaults |

### AI Signal Generation

- **Primary model:** NVIDIA Qwen 3.6 (via `NVIDIA_API_KEY`)
- **Fallbacks (in order):** OpenAI → Anthropic Claude → Google Gemini
- **Scheduler:** Auto‑generates signals every 15 minutes during IST market hours (09:15–15:30, Mon–Fri)
- **Expiry:** Stale signals auto‑expire every 5 minutes

---

## 🛠️ Tech Stack & Versions

### Runtime & Package Manager

| Tool | Version |
|---|---|
| Node.js | 20+ (tested on v24.13.0) |
| pnpm | 10+ (tested on v10.26.1) |
| TypeScript | ~5.9.2 |

### Backend (`artifacts/api-server`)

| Library | Version | Purpose |
|---|---|---|
| Express | ^5 | HTTP server & REST API |
| Drizzle ORM | ^0.45.2 | PostgreSQL ORM |
| drizzle‑kit | latest | DB migrations & schema push |
| yahoo‑finance2 | ^3.14.0 | Market data (quotes, history, options) |
| technicalindicators | ^3.1.0 | RSI, MACD, BB, ATR, Stochastic |
| openai | ^6.27.0 | OpenAI & NVIDIA API client |
| @anthropic‑ai/sdk | ^0.92.0 | Anthropic Claude client |
| cross‑env | latest | Cross‑platform environment variables |
| pino / pino‑http | ^9 / ^10 | Structured JSON logging |
| cors | ^2 | Cross‑origin headers |
| cookie‑parser | ^1.4.7 | NSE session cookie management |
| esbuild | ^0.27.3 | Production bundler |
| zod | ^3.25.76 | Schema validation |

### Frontend (`artifacts/market-dashboard`)

| Library | Version | Purpose |
|---|---|---|
| React | 19.1.0 | UI framework |
| Vite | ^7.3.2 |
| Tailwind CSS | ^4.1.14 |
| shadcn/ui (Radix) | various |
| TanStack Query | ^5.90.21 |
| wouter | ^3.3.5 |
| lightweight‑charts | ^5.2.0 |
| recharts | ^2.15.2 |
| framer‑motion | ^12.23.24 |
| jszip | ^3.10.1 |
| lucide‑react | ^0.545.0 |
| zod | ^3.25.76 |

### Database

| Tool | Description |
|---|---|
| PostgreSQL | 14+ — primary database |
| Drizzle ORM | Schema definitions + query builder |

#### Database Tables

| Table | Purpose |
|---|---|
| `signals` | AI trading signals (action, entry, target, stop‑loss, confidence, status) |
| `watchlist` | User‑saved symbols |
| `provider_settings` | AI provider API keys stored securely in DB |
| `conversations` | AI agent conversation history |
| `messages` | Individual AI agent messages |

---

## 📁 Project Structure

```text
/
├── artifacts/
│   ├── api-server/          # Express REST API (Node.js ESM)
│   │   └── src/
│   │       ├── routes/      # market, signals, analysis, watchlist, agent, scheduler
│   │       └── lib/         # NSE client, multi‑AI, scheduler, logger
│   └── market-dashboard/    # React + Vite frontend
│       └── src/
│           ├── pages/       # 11 pages (dashboard, signals, options, charts, etc.)
│           ├── components/  # sidebar, live‑refresh‑bar, shadcn UI
│           └── hooks/       # use‑live‑refresh, use‑toast
├── lib/
│   ├── db/                  # Drizzle schema + DB client (shared lib)
│   ├── api-spec/            # OpenAPI spec + codegen
│   └── api-client-react/    # Generated TanStack Query hooks
├── pnpm‑workspace.yaml      # Monorepo config & catalog
└── package.json             # Root scripts
```

---

## 🚀 Quick Start (Windows)

```powershell
# 1️⃣ Clone the repo
git clone <your-repo-url>
cd <repo-folder>

# 2️⃣ Fix Windows‑specific overrides (remove the `overrides:` block)
notepad pnpm-workspace.yaml   # delete everything from `overrides:` to EOF

# 3️⃣ Remove Unix‑only preinstall script
notepad package.json          # delete the `preinstall` line

# 4️⃣ Install dependencies
pnpm install

# 5️⃣ Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE trading_terminal;"
psql -U postgres -c "CREATE USER trading_user WITH PASSWORD 'yourpassword';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE trading_terminal TO trading_user;"

# 6️⃣ Create .env (project root)
@"
DATABASE_URL=postgresql://trading_user:yourpassword@localhost:5432/trading_terminal
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
"@ > .env

# 7️⃣ Run migrations
cd lib\db
$env:DATABASE_URL="postgresql://trading_user:yourpassword@localhost:5432/trading_terminal"
pnpm drizzle-kit push
cd ..\..\

# 8️⃣ Build shared libraries
pnpm run typecheck:libs

# 9️⃣ Add Vite proxy (required locally)
#    Edit artifacts/market-dashboard/vite.config.ts → add `proxy` block under `server`

# 🔟 Start API server (new PowerShell window)
$env:PORT="3001"
$env:DATABASE_URL="postgresql://trading_user:yourpassword@localhost:5432/trading_terminal"
$env:NVIDIA_API_KEY="nvapi-xxxxxxxxxxxxxxxxxxxx"
pnpm --filter @workspace/api-server run dev

# 1️⃣1️⃣ Start frontend (second PowerShell window)
$env:PORT="5173"
pnpm --filter @workspace/market-dashboard run dev

# 1️⃣2️⃣ Open in browser
http://localhost:5173
```

> **Tip:** Install `dotenv-cli` (`npm i -g dotenv-cli`) and launch services with `dotenv -e .env -- pnpm …` to avoid manual `$env:` assignments.

---

## 📊 Current Status

- **Fully functional:** Live market data, AI signal generation, options chain, technical indicators, charts, backtesting, Bhavcopy upload.
- **Known limitations:**
  - Futures OI is simulated (no free real‑time source).
  - AI signals rely on NVIDIA Qwen; fallback keys must be set in the Settings page.
  - Windows installation requires the manual fixes described above.
- **Roadmap (next release):** Docker support, automated CI/CD, multi‑user authentication, additional AI providers.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/awesome‑feature`).
3. Follow the existing code style (ESLint + Prettier configured).
4. Run `pnpm run typecheck:libs && pnpm run lint` before committing.
5. Open a Pull Request – describe the change and reference any related issue.

---

## 📄 License & Acknowledgements

- Licensed under the **MIT License**.
- Thanks to the open‑source community for libraries such as **Express**, **Drizzle ORM**, **Tailwind CSS**, **React**, and **lightweight‑charts**.
- AI models powered by **NVIDIA**, **OpenAI**, **Anthropic**, and **Google Gemini**.

---

*Created on 2026‑06‑08.*
