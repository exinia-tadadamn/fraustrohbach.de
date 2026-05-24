import { test, expect } from '@playwright/test';

test('clicking a gallery card opens a fullscreen viewer with the same image, Esc closes', async ({ page }) => {
  await page.goto('/');

  await page.locator('button', { hasText: 'VISUAL GALLERY' }).click();
  const modal = page.locator('#gallery-modal');
  await expect(modal).toBeVisible();

  const cards = page.locator('#modal-lenses-grid > div');
  await expect(cards).toHaveCount(87);

  // Capture the first card's image src, then click the card.
  const firstThumb = cards.first().locator('img');
  const firstSrc = await firstThumb.getAttribute('src');
  expect(firstSrc).toMatch(/imagesTimeMashine\/image1\./);

  await cards.first().click();

  // Fullscreen viewer becomes visible, shows the same image, and is layered above the gallery modal.
  const viewer = page.locator('#image-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img')).toHaveAttribute('src', /imagesTimeMashine\/image1\./);

  // The viewer img should occupy a large portion of the viewport (fullscreen, not a thumbnail).
  const dims = await viewer.locator('img').evaluate((el) => ({
    w: (el as HTMLImageElement).getBoundingClientRect().width,
    h: (el as HTMLImageElement).getBoundingClientRect().height,
    vw: window.innerWidth,
    vh: window.innerHeight,
  }));
  expect(dims.w).toBeGreaterThan(dims.vw * 0.5);
  expect(dims.h).toBeGreaterThan(dims.vh * 0.5);

  // Esc closes the viewer but the gallery modal stays open behind it.
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(modal).toBeVisible();

  // Clicking the close button inside the viewer also works.
  await cards.nth(1).click();
  await expect(viewer).toBeVisible();
  await viewer.locator('button', { hasText: 'Close' }).click();
  await expect(viewer).toBeHidden();
  await expect(modal).toBeVisible();
});
