import { test, expect } from '@playwright/test';

test('homepage basic checks and visual archive modal', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Exinia | Temporal Lenses');
  await expect(page.locator('text=Temporal Observation Protocol')).toBeVisible();

  await page.click('a[href="#lenses"]');
  await expect(page.locator('h2', { hasText: 'Through the Lenses' })).toBeVisible();

  const trigger = page.locator('button', { hasText: 'VISUAL GALLERY' });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const modal = page.locator('#gallery-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('text=VISUAL ARCHIVE')).toBeVisible();

  const cards = page.locator('#modal-lenses-grid > div');
  await expect(cards).toHaveCount(87);
  await expect(cards.first().locator('img')).toHaveAttribute(
    'src',
    /imagesTimeMashine\/image1\./
  );

  // Regression: scroll container must be actually scrollable (scrollHeight > clientHeight)
  // and scrolling must move scrollTop. Catches modal display:none → block bug that
  // collapses the flex layout and kills the inner scroll.
  const scrollMetrics = await page.locator('#gallery-scroll-container').evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  await page.locator('#gallery-scroll-container').evaluate((el) => el.scrollTo({ top: 800 }));
  await expect
    .poll(() => page.locator('#gallery-scroll-container').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);

  await modal.locator('button', { hasText: 'Close' }).click();
  await expect(modal).toBeHidden();
});
