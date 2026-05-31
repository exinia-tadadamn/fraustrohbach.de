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

  const cards = page.locator('#album-images-grid > div');
  // Gallery images load asynchronously from Firestore or legacy scan.
  // Wait up to 10s for at least some images to appear before asserting the full count.
  await expect.poll(() => cards.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(cards).toHaveCount(87);
  await expect(cards.first().locator('img')).toHaveAttribute(
    'src',
    /imagesTimeMashine\/image1\./
  );

  // Regression: scroll container must be actually scrollable (scrollHeight > clientHeight)
  // and scrolling must move scrollTop. Catches modal display:none → block bug that
  // collapses the flex layout and kills the inner scroll.
  const scrollContainer = page.locator('#album-detail-view');
  const scrollMetrics = await scrollContainer.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  await scrollContainer.evaluate((el) => el.scrollTo({ top: 800 }));
  await expect
    .poll(() => scrollContainer.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);

  await modal.locator('button', { hasText: 'Close' }).click();
  await expect(modal).toBeHidden();
});

test('gallery displays all 87 images without 404 errors', async ({ page }) => {
  // Collect console errors during page load
  const consoleMessages: { type: string; text: string }[] = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  await page.goto('/');

  // Open gallery
  await page.click('text=VISUAL GALLERY');
  await expect(page.locator('#gallery-modal')).toBeVisible();

  // Wait for async gallery render (Firestore or legacy scan)
  const imageLocator = page.locator('#album-images-grid img');
  await expect.poll(() => imageLocator.count(), { timeout: 10_000 }).toBe(87);

  // Verify all images have src attribute set (loaded)
  const imagesWithSrc = await page.locator('#album-images-grid img[src]').count();
  expect(imagesWithSrc).toBe(87);

  // Check for 404 errors in console (restrict to gallery images)
  const errors = consoleMessages.filter(msg => msg.type === 'error');
  const imageErrors = errors.filter(e =>
    e.text.includes('Failed to load resource') && e.text.includes('imagesTimeMashine')
  );
  expect(imageErrors.length).toBe(0);
});

test('gallery scrolling and scroll-to-top button functionality', async ({ page }) => {
  await page.goto('/');

  // Open gallery
  await page.click('text=VISUAL GALLERY');
  await expect(page.locator('#gallery-modal')).toBeVisible();

  // Wait for gallery images to render before scrolling
  await expect.poll(() => page.locator('#album-images-grid > div').count(), { timeout: 10_000 }).toBeGreaterThan(0);

  const scrollContainer = page.locator('#album-detail-view');

  // Initial scroll position should be 0
  let scrollTop = await scrollContainer.evaluate(el => el.scrollTop);
  expect(scrollTop).toBe(0);

  // Scroll down
  await scrollContainer.evaluate(el => {
    el.scrollTop = 500;
  });

  // Verify scrolling worked
  scrollTop = await scrollContainer.evaluate(el => el.scrollTop);
  expect(scrollTop).toBe(500);

  // Check that scroll-to-top button appears
  const scrollBtn = page.locator('#scroll-to-top-btn');
  await page.waitForTimeout(300); // Wait for animation

  // Button should be visible after scrolling > 300px
  const isVisible = await scrollBtn.evaluate(el => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none';
  });
  expect(isVisible).toBe(true);

  // Dismiss cookie consent overlay so it does not intercept the click
  await page.locator('#cookiescript_close').click().catch(() => {});

  // Click scroll-to-top button
  await scrollBtn.click();

  // Verify scroll position reset (smooth scroll may take >500ms)
  await expect.poll(() => scrollContainer.evaluate(el => el.scrollTop), { timeout: 3000 }).toBe(0);
});

test('gallery keyboard navigation', async ({ page }) => {
  await page.goto('/');

  // Open gallery
  await page.click('text=VISUAL GALLERY');
  await expect(page.locator('#gallery-modal')).toBeVisible();

  // Wait for gallery images to render before scrolling
  await expect.poll(() => page.locator('#album-images-grid > div').count(), { timeout: 10_000 }).toBeGreaterThan(0);

  const scrollContainer = page.locator('#album-detail-view');

  // Focus scroll container
  await scrollContainer.focus();

  // Initial position
  let scrollTop = await scrollContainer.evaluate(el => el.scrollTop);
  expect(scrollTop).toBe(0);

  // Arrow Down should scroll
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500); // Smooth scroll

  let newScrollTop = await scrollContainer.evaluate(el => el.scrollTop);
  expect(newScrollTop).toBeGreaterThan(scrollTop);

  // Arrow Up should scroll back
  scrollTop = newScrollTop;
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(500);

  newScrollTop = await scrollContainer.evaluate(el => el.scrollTop);
  expect(newScrollTop).toBeLessThan(scrollTop);

  // Escape should close gallery
  await page.keyboard.press('Escape');
  await expect(page.locator('#gallery-modal')).toBeHidden();
});

test('gallery modal scrollbar is visible when content overflows', async ({ page }) => {
  await page.goto('/');

  // Open gallery
  await page.click('text=VISUAL GALLERY');
  await expect(page.locator('#gallery-modal')).toBeVisible();

  // Wait for gallery images to render so container has scrollable height
  await expect.poll(() => page.locator('#album-images-grid > div').count(), { timeout: 10_000 }).toBeGreaterThan(0);

  const scrollContainer = page.locator('#album-detail-view');

  // Verify scrollbar styling is applied (class exists)
  const hasScrollbarClass = await scrollContainer.evaluate(el =>
    el.classList.contains('gallery-scrollbar')
  );
  expect(hasScrollbarClass).toBe(true);

  // Verify element has overflow-y-auto
  const hasOverflow = await scrollContainer.evaluate(el => {
    const style = window.getComputedStyle(el);
    return style.overflowY === 'auto';
  });
  expect(hasOverflow).toBe(true);

  // Verify scrollable height is greater than client height
  const isScrollable = await scrollContainer.evaluate(el =>
    el.scrollHeight > el.clientHeight
  );
  expect(isScrollable).toBe(true);
});
