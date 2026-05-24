import { test, expect } from 'playwright-mcp';

test('homepage basic checks and gallery modal', async ({ page }) => {
  await page.goto('/');

  // Title
  await expect(page).toHaveTitle('Exinia | Temporal Lenses');

  // Hero text visible
  await expect(page.locator('text=Temporal Observation Protocol')).toBeVisible();

  // Navigate to the lenses section via anchor and verify heading
  await page.click('a[href="#lenses"]');
  await expect(page.locator('h2', { hasText: 'Through the Lenses' })).toBeVisible();

  // Ensure archive teaser is present
  await expect(page.locator('text=Access Full Visual Archive')).toBeVisible();

  // Open gallery modal by clicking the teaser area (click inner text so event bubbles)
  await page.click('text=Access Full Visual Archive');
  await expect(page.locator('#gallery-modal')).toBeVisible();

  // Close gallery modal
  await page.click('text=Close');
  await expect(page.locator('#gallery-modal')).toBeHidden();
});
