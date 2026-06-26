# Project-Specific Agent Rules

These rules apply specifically to tasks in the `nse-bse-trading-terminal` repository.

## Database Testing Guardrails
- **SQLite Database Locking**: Running integration/E2E test suites concurrently using Vitest on the local SQLite database file can cause `SQLITE_BUSY: database is locked`. Always run test suites sequentially by appending `--sequence.concurrent=false` to the test execution command, or execute test suites individually (e.g., `pnpm --filter @workspace/api-server test -- --sequence.concurrent=false`).

## Theme & Style Guidelines
- **Dynamic Themes (Tailwind CSS v4)**: Theme switching is managed dynamically by the `ThemeProvider` which adds or removes the `light` or `dark` classes on the `html` element. Never hardcode classes like `dark` or `light` on main layouts, wrappers, or global page containers, as this overrides the active theme selection and prevents dynamic theme changes from rendering.
