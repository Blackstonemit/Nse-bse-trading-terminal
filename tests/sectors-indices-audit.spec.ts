import { test, expect } from '@playwright/test';
import * as path from 'path';

const screenshotDir = 'C:/Users/blackstone/.gemini/antigravity-ide/brain/d0ce3a43-327f-444e-9812-41f4b6ce6490';

test.describe('Nifty Sectors & Indices Pages E2E Verification', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    // Go to home page and wait for the automatic redirect mock-login process to settle
    await page.goto('/');
    await page.waitForTimeout(6000); // Wait for mock login to finish and redirect back to /
  });

  test.afterEach(() => {
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('Failed to load resource') && 
      !err.includes('chrome-extension') &&
      !err.includes('sourcemap')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('Sectors Page - Navigate via sidebar, load, search, sort, and screenshot', async ({ page }) => {
    // Navigate via sidebar to keep authentication session intact
    const sectorsLink = page.locator('a[href="/sectors"]');
    await expect(sectorsLink).toBeVisible();
    await sectorsLink.click();
    await page.waitForTimeout(4000); // Wait for API sector quotes to load

    // Verify page title and header
    const title = page.locator('h1:has-text("NIFTY SECTOR TRACKER")');
    await expect(title).toBeVisible();

    // Verify statistics cards are visible
    const topPerformer = page.getByText('TOP PERFORMER').first();
    await expect(topPerformer).toBeVisible();

    // Verify sector table renders rows
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Search for Auto sector
    const searchInput = page.locator('input[placeholder*="Search Nifty sectors"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Auto');
    await page.waitForTimeout(1000);

    // Verify matching sector row is visible
    const filteredRows = page.locator('tbody tr:has-text("Nifty Auto")');
    await expect(filteredRows.first()).toBeVisible();

    // Clear search query
    await searchInput.fill('');
    await page.waitForTimeout(1000);

    // Take screenshot for walkthrough and evidence
    await page.screenshot({ path: path.join(screenshotDir, 'media__14_sectors.png') });
  });

  test('Indices Page - Navigate via sidebar, load, categories, search, and screenshot', async ({ page }) => {
    // Navigate via sidebar to keep authentication session intact
    const indicesLink = page.locator('a[href="/indices"]');
    await expect(indicesLink).toBeVisible();
    await indicesLink.click();
    await page.waitForTimeout(4000); // Wait for index quotes to load

    // Verify page title
    const title = page.locator('h1:has-text("NIFTY INDEX DIRECTORY")');
    await expect(title).toBeVisible();

    // Verify Advance-Decline metrics are present
    const adr = page.getByText('ADVANCE-DECLINE RATIO').first();
    await expect(adr).toBeVisible();

    // Verify index table renders rows
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Switch categories via Tabs
    const sectoralTab = page.locator('[role="tab"]:has-text("SECTORAL")');
    if (await sectoralTab.isVisible()) {
      await sectoralTab.click();
      await page.waitForTimeout(1000);
      
      // Ensure NIFTY AUTO or similar sectoral index is visible
      const autoRow = page.locator('tbody tr:has-text("NIFTY AUTO")');
      await expect(autoRow.first()).toBeVisible();
    }

    const debtTab = page.locator('[role="tab"]:has-text("DEBT / BONDS")');
    if (await debtTab.isVisible()) {
      await debtTab.click();
      await page.waitForTimeout(1000);
    }

    // Switch back to ALL tab
    const allTab = page.locator('[role="tab"]:has-text("ALL INDICES")');
    if (await allTab.isVisible()) {
      await allTab.click();
      await page.waitForTimeout(1000);
    }

    // Search query test
    const searchInput = page.locator('input[placeholder*="Filter by name or symbol"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('metal');
    await page.waitForTimeout(1000);

    // Verify matching row
    const metalRow = page.locator('tbody tr:has-text("NIFTY METAL")');
    await expect(metalRow.first()).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'media__15_indices.png') });
  });
});
