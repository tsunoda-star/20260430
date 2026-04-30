import { test, expect } from './fixtures';

/**
 * Cycle 5.3: 認証不要のランディングページ smoke.
 * (公開対象: トップ画面 / auth/login / auth/callback)
 */

test.describe('landing (guest)', () => {
  test('renders hero + URL input form for unauthenticated users', async ({ guestPage }) => {
    const res = await guestPage.goto('/');
    expect(res?.status()).toBeLessThan(400);

    await expect(
      guestPage.getByRole('heading', {
        name: /URL一つで.*セキュリティ対策の地図/,
      }),
    ).toBeVisible();
    await expect(guestPage.getByPlaceholder(/your-company/i)).toBeVisible();
    await expect(guestPage.getByRole('button', { name: /分析を開始/ })).toBeVisible();
  });

  test('zod validation rejects http://example.com (https only)', async ({ guestPage }) => {
    await guestPage.goto('/');
    await guestPage.getByPlaceholder(/your-company/i).fill('http://example.com');
    await guestPage.getByRole('button', { name: /分析を開始/ }).click();
    await expect(
      guestPage.getByText(/https から始まる正しい URL/),
    ).toBeVisible();
  });

  test('shows toast on valid submission (Wave 2 完了までの placeholder)', async ({ guestPage }) => {
    await guestPage.goto('/');
    await guestPage.getByPlaceholder(/your-company/i).fill('https://example.com');
    await guestPage.getByRole('button', { name: /分析を開始/ }).click();
    await expect(guestPage.getByText(/URL を受け付けました/)).toBeVisible();
  });
});
