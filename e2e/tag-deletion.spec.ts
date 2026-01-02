import { test, expect } from '@playwright/test';

const maybeLogin = async (page: any) => {
  // If the login overlay is shown, it has a distinct heading.
  const loginHeading = page.locator('text=System Access');
  if (await loginHeading.isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.getByRole('button', { name: /^LOGIN$/i }).click();
    // Wait for landing hub to appear
    await expect(page.locator('h1')).toContainText(/TEAM/i, { timeout: 15000 });
  }
};

test.describe('Tags - Global Purge', () => {
  test('should show purge progress and remove an in-use tag', async ({ page }) => {
    await page.goto('/');
    await maybeLogin(page);

    // Navigate: HOME -> EDIT -> EDIT TASK (opens TaskMaster)
    await page.getByRole('heading', { name: /TEAM/i }).waitFor({ timeout: 15000 }).catch(() => {});

    await page.getByText('EDIT', { exact: true }).click();
    await page.getByText('EDIT TASK', { exact: true }).click();

    // TaskMaster modal
    await expect(page.getByText('TASK MASTER', { exact: false })).toBeVisible({ timeout: 15000 });

    // Open tags registry
    await page.getByText('TAGS & CATEGORIES', { exact: true }).click();
    await expect(page.getByText('TAG CATEGORIES', { exact: true })).toBeVisible({ timeout: 15000 });

    // The demo content uses the "demo" tag. Purge it.
    // Click the trash button on the "demo" tag row.
    const row = page
      .locator('div')
      .filter({ has: page.locator('h3', { hasText: /^demo$/i }) })
      .first();

    await row.locator('button[title="GLOBAL PURGE"]').click();

    await expect(page.getByText('GLOBAL PURGE?', { exact: true })).toBeVisible();

    const start = Date.now();
    await page.getByRole('button', { name: /CONFIRM PURGE/i }).click();

    // Progress UI should appear while operation runs.
    await expect(page.locator('text=PURGING...').or(page.locator('text=/\d+%/'))).toBeVisible({ timeout: 5000 });

    // Modal should close when finished.
    await expect(page.getByText('GLOBAL PURGE?', { exact: true })).toBeHidden({ timeout: 30000 });

    const durationMs = Date.now() - start;
    expect(durationMs).toBeLessThan(30000);

    // Tag should no longer be listed.
    await expect(page.getByText(/^demo$/i)).toBeHidden({ timeout: 15000 });
  });
});
