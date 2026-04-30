import { test, expect } from './fixtures';

/**
 * Cycle 5.3 / spec.md §5.3: Viewer エクスポート専用フロー検証.
 *
 * Pre-conditions: TEST_VIEWER_EMAIL/PASSWORD が設定され auth.setup で
 * playwright/.auth/viewer.json が生成済みであること。
 */

test.describe('viewer-only flow', () => {
  test('shows WhyDisabledBanner on landing', async ({ viewerPage }) => {
    await viewerPage.goto('/');
    await expect(viewerPage.getByText(/あなたは.*Viewer.*閲覧とエクスポート/)).toBeVisible();
  });

  test('replaces URL input with export CTA', async ({ viewerPage }) => {
    await viewerPage.goto('/');
    await expect(
      viewerPage.getByText(/閲覧者.*エクスポート機能のみ/),
    ).toBeVisible();
    await expect(viewerPage.getByRole('link', { name: /エクスポート画面を開く/ })).toBeVisible();
  });

  test('redirects from forbidden /app/admin/users to /app/viewer', async ({ viewerPage }) => {
    await viewerPage.goto('/app/admin/users');
    await expect(viewerPage).toHaveURL(/\/app\/viewer/);
  });

  test('hides URL input form (no input element rendered for viewer)', async ({ viewerPage }) => {
    await viewerPage.goto('/');
    await expect(viewerPage.getByPlaceholder(/your-company/i)).not.toBeVisible();
  });

  test('GET /api/v1/me returns role=viewer with limited permissions', async ({ viewerPage }) => {
    const res = await viewerPage.request.get('/api/v1/me');
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { role: string; permissions: string[] };
    expect(body.role).toBe('viewer');
    expect(body.permissions.sort()).toEqual(['assessment.read', 'export.run']);
  });

  test('POST /api/v1/companies returns 403 forbidden', async ({ viewerPage }) => {
    const res = await viewerPage.request.post('/api/v1/companies', {
      data: { url: 'https://example.com' },
    });
    expect(res.status()).toBe(403);
  });
});
