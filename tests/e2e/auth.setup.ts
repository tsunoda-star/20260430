import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Cycle 5.3: 5 ロールごとに Cognito Hosted UI で認証し storageState を保存.
 *
 * 必要な環境変数 (.env.local の上書きでも、CI secret でも可):
 *   TEST_OWNER_EMAIL    / TEST_OWNER_PASSWORD
 *   TEST_ADMIN_EMAIL    / TEST_ADMIN_PASSWORD
 *   TEST_EDITOR_EMAIL   / TEST_EDITOR_PASSWORD
 *   TEST_REVIEWER_EMAIL / TEST_REVIEWER_PASSWORD
 *   TEST_VIEWER_EMAIL   / TEST_VIEWER_PASSWORD
 *
 * いずれかが欠落しているロールはセットアップを skip する。
 * Cognito Hosted UI のフォーム CSS セレクタが変わった場合は
 * `loginThroughHostedUI` を更新すること (現状は Amazon Cognito の標準テンプレ準拠)。
 */

const authDir = path.join(process.cwd(), 'playwright', '.auth');

const ROLES = ['owner', 'admin', 'editor', 'reviewer', 'viewer'] as const;
type Role = (typeof ROLES)[number];

function credsForRole(role: Role): { email?: string; password?: string } {
  const upper = role.toUpperCase();
  return {
    email: process.env[`TEST_${upper}_EMAIL`],
    password: process.env[`TEST_${upper}_PASSWORD`],
  };
}

async function loginThroughHostedUI(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<void> {
  // /auth/login → Cognito Hosted UI へ自動リダイレクト
  await page.goto('/auth/login');
  await page.getByLabel(/email|user/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|ログイン/i }).click();
  // /auth/callback で session cookie が確立されるまで待つ
  await page.waitForURL((u) => u.pathname.startsWith('/auth/callback') === false, {
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/\/(?!auth\/login)/);
}

for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, password } = credsForRole(role);
    setup.skip(!email || !password, `TEST_${role.toUpperCase()}_EMAIL/PASSWORD not set`);
    await loginThroughHostedUI(page, email!, password!);
    await page.context().storageState({ path: path.join(authDir, `${role}.json`) });
  });
}
