import { test, expect } from '@playwright/test';
import * as path from 'path';

// Target directory for verification screenshots
const screenshotDir = 'C:/Users/blackstone/.gemini/antigravity-ide/brain/d0ce3a43-327f-444e-9812-41f4b6ce6490';

test.describe('NSE/BSE Trading Terminal E2E Audit', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });
  });

  test.afterEach(() => {
    // Filter out standard non-blocking warnings or sourcemap errors
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('Failed to load resource') && 
      !err.includes('chrome-extension') &&
      !err.includes('sourcemap')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('Page 1: Live Dashboard & watchlists', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(4000); // Wait for API calls to settle
    await page.screenshot({ path: path.join(screenshotDir, 'media__1_dashboard.png') });

    // Open add symbol search modal
    const addPinBtn = page.locator('button:has-text("ADD SYMBOL"), button:has-text("Search and pin")').first();
    if (await addPinBtn.isVisible()) {
      await addPinBtn.click();
      await page.waitForTimeout(1000);
      
      // Type RELIANCE and press Enter
      const searchInput = page.locator('input[placeholder*="Search NSE/BSE"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('RELIANCE');
        await page.waitForTimeout(1000);
        await searchInput.press('Enter');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(screenshotDir, 'media__1_dashboard_pinned.png') });
      }
    }

    // Perform manual refresh click
    const refreshBtn = page.locator('button:has-text("NOW")');
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('Page 2: Signals Board & active trade alerts', async ({ page }) => {
    await page.goto('/signals');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__2_signals.png') });

    // Trigger AI Scheduler RUN NOW
    const runBtn = page.locator('button:has-text("RUN NOW")');
    if (await runBtn.isVisible()) {
      await runBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotDir, 'media__2_signals_scheduler_run.png') });
    }

    // Trigger AI Scheduler EXPIRE NOW
    const expireBtn = page.locator('button:has-text("EXPIRE NOW")');
    if (await expireBtn.isVisible()) {
      await expireBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('Page 3: 5M Scalper & indicators', async ({ page }) => {
    await page.goto('/scalping');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__3_scalping.png') });

    // Click BANKNIFTY preset
    const presetBtn = page.locator('button:has-text("BANKNIFTY")').first();
    if (await presetBtn.isVisible()) {
      await presetBtn.click();
      await page.waitForTimeout(2000);
    }

    // Toggle overlay indicator buttons
    const overlayButtons = ['SMA20', 'EMA9', 'BB'];
    for (const label of overlayButtons) {
      const btn = page.locator(`button:has-text("${label}")`);
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    }
    await page.screenshot({ path: path.join(screenshotDir, 'media__3_scalping_toggled.png') });
  });

  test('Page 4: Paper Trader order execution', async ({ page }) => {
    await page.goto('/paper-trading');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__4_paper_trading.png') });

    // Enter symbol
    const symInput = page.locator('input[placeholder="e.g. RELIANCE, TCS, NIFTY"]');
    if (await symInput.isVisible()) {
      await symInput.fill('RELIANCE');
      await page.waitForTimeout(500);
    }

    // Switch action Tab to SELL (SHORT)
    const sellBtn = page.locator('button:has-text("SELL (SHORT)")');
    if (await sellBtn.isVisible()) {
      await sellBtn.click();
      await page.waitForTimeout(500);
    }

    // Switch order type to LIMIT
    const limitBtn = page.locator('button:has-text("LIMIT")');
    if (await limitBtn.isVisible()) {
      await limitBtn.click();
      await page.waitForTimeout(500);
    }

    // Fill price
    const priceInput = page.locator('input[placeholder="Enter limit price..."]');
    if (await priceInput.isVisible()) {
      await priceInput.fill('1300');
      await page.waitForTimeout(500);
    }

    // Fill quantity
    const qtyInput = page.locator('input[type="number"]').first();
    if (await qtyInput.isVisible()) {
      await qtyInput.fill('100');
      await page.waitForTimeout(500);
    }

    // Click submit
    const orderBtn = page.locator('button:has-text("EXECUTE SIMULATED ORDER")');
    if (await orderBtn.isVisible()) {
      await orderBtn.click();
      await page.waitForTimeout(3000); // Wait for API database updates
      await page.screenshot({ path: path.join(screenshotDir, 'media__4_paper_trading_submitted.png') });
    }
  });

  test('Page 5: Market Feed boards', async ({ page }) => {
    await page.goto('/market');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__5_market.png') });
  });

  test('Page 6: Options Chain chain grid', async ({ page }) => {
    await page.goto('/options');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__6_options.png') });

    // Search for BANKNIFTY options
    const searchInput = page.locator('input[placeholder*="SYMBOL..."]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('BANKNIFTY');
      await searchInput.press('Enter');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotDir, 'media__6_options_banknifty.png') });
    }

    // Click the GREEKS toggle button
    const greeksBtn = page.locator('button:has-text("GREEKS")');
    if (await greeksBtn.isVisible()) {
      await greeksBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotDir, 'media__6_options_greeks_toggled.png') });
    }

    // Add a leg to strategy builder
    const buyLegBtn = page.locator('button:has-text("B")').first();
    if (await buyLegBtn.isVisible()) {
      await buyLegBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, 'media__6_options_strategy_leg_added.png') });
    }
  });

  test('Page 7: Futures Feed contracts', async ({ page }) => {
    await page.goto('/futures');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__7_futures.png') });
  });

  test('Page 8: Technical Analysis indicators', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__8_analysis.png') });

    // Switch analysis interval to 15m
    const tfBtn = page.locator('button:has-text("15m")');
    if (await tfBtn.isVisible()) {
      await tfBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotDir, 'media__8_analysis_15m.png') });
    }
  });

  test('Page 9: Charts advanced pane', async ({ page }) => {
    await page.goto('/charts');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__9_charts_5m.png') });

    // Toggle different chart intervals to ensure they all render successfully
    const intervals = ['1m', '15m', '1H', '1D'];
    for (const interval of intervals) {
      const btn = page.locator(`button:has-text("${interval}")`);
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(3000); // Wait for historical quotes to load
        await page.screenshot({ path: path.join(screenshotDir, `media__9_charts_${interval}.png`) });
      }
    }

    // Toggle grid layouts
    const layout1x2Btn = page.locator('button:has-text("1x2")');
    if (await layout1x2Btn.isVisible()) {
      await layout1x2Btn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, 'media__9_charts_1x2_layout.png') });
    }

    const layout2x2Btn = page.locator('button:has-text("2x2")');
    if (await layout2x2Btn.isVisible()) {
      await layout2x2Btn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, 'media__9_charts_2x2_layout.png') });
    }
  });

  test('Page 10: Backtest simulation run', async ({ page }) => {
    await page.goto('/backtest');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__10_backtest.png') });

    // Click Run Backtest button
    const runBtn = page.locator('button:has-text("RUN BACKTEST")');
    if (await runBtn.isVisible()) {
      await runBtn.click();
      await page.waitForTimeout(3000); // Wait for backtest computation
      await page.screenshot({ path: path.join(screenshotDir, 'media__10_backtest_run.png') });
    }

    // Switch to Strategy Sweep Optimizer
    const optimizerTab = page.locator('button:has-text("Strategy Sweep Optimizer")');
    if (await optimizerTab.isVisible()) {
      await optimizerTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, 'media__10_backtest_optimizer_tab.png') });

      // Click run sweep button
      const runSweepBtn = page.locator('button:has-text("RUN SWEEP OPTIMIZER")');
      if (await runSweepBtn.isVisible()) {
        await runSweepBtn.click();
        await page.waitForTimeout(4000); // Wait for historical loading + client simulation
        await page.screenshot({ path: path.join(screenshotDir, 'media__10_backtest_sweep_run.png') });

        // Select a row from the results table
        const row = page.locator('tr:has-text("/")').nth(2);
        if (await row.isVisible()) {
          await row.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: path.join(screenshotDir, 'media__10_backtest_sweep_row_selected.png') });
        }
      }
    }
  });

  test('Page 11: Bhavcopy downloader', async ({ page }) => {
    await page.goto('/bhavcopy');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__11_bhavcopy.png') });
  });

  test('Page 12: Watchlist custom boards', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__12_watchlist.png') });

    // Add TCS symbol to Watchlist
    const symInput = page.locator('input[placeholder="e.g. RELIANCE"]');
    const nameInput = page.locator('input[placeholder="e.g. Reliance Industries"]');
    const addBtn = page.locator('button:has-text("ADD")');

    if (await symInput.isVisible() && await nameInput.isVisible() && await addBtn.isVisible()) {
      await symInput.fill('TCS');
      await nameInput.fill('Tata Consultancy Services');
      await addBtn.click();
      await page.waitForTimeout(2000); // Wait for watchlist addition
      await page.screenshot({ path: path.join(screenshotDir, 'media__12_watchlist_added.png') });
      
      // Clean up by clicking the delete/trash button on the newly added symbol
      const trashBtn = page.locator('button:has(svg.lucide-trash2)').last();
      if (await trashBtn.isVisible()) {
        await trashBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(screenshotDir, 'media__12_watchlist_cleaned.png') });
      }
    }
  });

  test('Page 13: Settings adjustment', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotDir, 'media__13_settings.png') });

    // Toggle the first custom switcher to verify interactions
    const toggleBtn = page.locator('button.relative.inline-flex').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotDir, 'media__13_settings_toggled.png') });
    }
  });
});
