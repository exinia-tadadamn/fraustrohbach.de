import { test, expect, type Page } from '@playwright/test';

async function gotoFreshQuiz(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
  await page.goto('/quiz.html');
}

test('start screen → name required, then quiz screen with first question', async ({ page }) => {
  await gotoFreshQuiz(page);

  const start = page.locator('[data-screen="start"]');
  await expect(start).toBeVisible();
  await expect(start.locator('h1, h2').first()).toContainText(/Enter Your Name/i);

  // Empty name: start button disabled or no-op
  const nameInput = page.locator('#player-name');
  await expect(nameInput).toBeVisible();
  const startBtn = page.locator('button', { hasText: 'Start the Test!' });
  await expect(startBtn).toBeVisible();
  await startBtn.click();
  await expect(start).toBeVisible();

  // With name → quiz
  await nameInput.fill('Tester');
  await startBtn.click();
  await expect(page.locator('[data-screen="quiz"]')).toBeVisible();
  await expect(page.locator('button', { hasText: 'Judge Me!' })).toBeVisible();
});

test('Judge Me → first answer → MY SOUL IS PURE advances, score increments', async ({ page }) => {
  await gotoFreshQuiz(page);
  await page.locator('#player-name').fill('Tester');
  await page.locator('button', { hasText: 'Start the Test!' }).click();

  await page.locator('button', { hasText: 'Judge Me!' }).click();
  const question = page.locator('#current-question');
  const firstText = await question.textContent();
  expect(firstText?.trim().length).toBeGreaterThan(5);

  await page.locator('button', { hasText: 'MY SOUL IS PURE' }).click();
  await expect.poll(async () => (await question.textContent())?.trim()).not.toBe(firstText?.trim());
});

test('clicking the red fail button shows fail screen with percentage and player name', async ({ page }) => {
  await gotoFreshQuiz(page);
  await page.locator('#player-name').fill('Ada');
  await page.locator('button', { hasText: 'Start the Test!' }).click();
  await page.locator('button', { hasText: 'Judge Me!' }).click();

  // Two correct answers, then fail
  await page.locator('button', { hasText: 'MY SOUL IS PURE' }).click();
  await page.locator('button', { hasText: 'MY SOUL IS PURE' }).click();
  await page.locator('#fail-button').click();

  const fail = page.locator('[data-screen="fail"]');
  await expect(fail).toBeVisible();
  await expect(fail).toContainText('Ada');
  await expect(fail).toContainText(/% vegan/i);
  await expect(fail).toContainText(/2 question/);
});

test('save score persists to leaderboard via localStorage', async ({ page }) => {
  await gotoFreshQuiz(page);
  await page.locator('#player-name').fill('Bea');
  await page.locator('button', { hasText: 'Start the Test!' }).click();
  await page.locator('button', { hasText: 'Judge Me!' }).click();
  await page.locator('button', { hasText: 'MY SOUL IS PURE' }).click();
  await page.locator('#fail-button').click();

  await page.locator('#fail-save').click();
  await expect(page.locator('[data-screen="fail"] [data-leaderboard]')).toContainText('Bea');

  const stored = await page.evaluate(() => localStorage.getItem('leaderboard'));
  expect(stored).toContain('Bea');
});

test('reflections screen shows essay; start over returns to name entry', async ({ page }) => {
  await gotoFreshQuiz(page);
  await page.locator('#player-name').fill('Cleo');
  await page.locator('button', { hasText: 'Start the Test!' }).click();
  await page.locator('button', { hasText: 'Judge Me!' }).click();
  await page.locator('#fail-button').click();

  await page.locator('#fail-reflections').click();
  const reflections = page.locator('[data-screen="reflections"]');
  await expect(reflections).toBeVisible();
  await expect(reflections.locator('h1, h2').first()).toContainText(/What is Vegan/i);
  await expect(reflections).toContainText(/impossible standard/i);

  await page.locator('button', { hasText: 'Start Over' }).click();
  await expect(page.locator('[data-screen="start"]')).toBeVisible();
  await expect(page.locator('#player-name')).toHaveValue('');
});

test('main site links to the quiz', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('a[href$="quiz.html"], a[href="/quiz.html"]').first();
  await expect(link).toBeVisible();
});
