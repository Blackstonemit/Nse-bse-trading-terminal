---
name: trading-terminal-operations
description: >-
  Interact with the local NSE/BSE Trading Terminal database. Use this skill
  when you need to fetch the latest AI trading signals, active stock quotes,
  or options data from the terminal's database.
---

# Trading Terminal Operations

## Overview
This skill allows the agent to interact with the NSE/BSE Trading Terminal's local PostgreSQL database.

## Workflow

### 1. Fetching Active Signals
When the user asks for "current signals" or "what should I buy":
- Connect to the local database `trading_terminal` using `psql` or `drizzle-kit`.
- Query the `signals` table for active or recent signals:
  `SELECT * FROM signals WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 10;`

### 2. Checking the Watchlist
When the user asks about their watched symbols:
- Query the `watchlist` table:
  `SELECT symbol FROM watchlist;`

### 3. Evaluating Provider Status
When the user wants to know which AI is generating signals:
- Query the `provider_settings` table to see which AI providers have `enabled = true`.

## Common Mistakes
- Do not attempt to query `options_chain` from the DB as it is fetched live in memory by the API server.
- Ensure the database URL `postgresql://trading_user:yourpassword@localhost:5432/trading_terminal` is accessible before querying.
