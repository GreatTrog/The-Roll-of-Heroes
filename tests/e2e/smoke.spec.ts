import { expect, test } from '@playwright/test';

test('can generate character', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByText('Character Controls')).toBeVisible();
});
