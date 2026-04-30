import { test as base, expect, type Page } from '@playwright/test';
import * as path from 'path';

/**
 * Cycle 5.3: 5 ロール × 主要操作 マトリクス向けの Page fixtures.
 *
 * Usage:
 *   import { test, expect } from '../fixtures';
 *
 *   test('Viewer は URL 入力フォームを見ない', async ({ viewerPage }) => {
 *     await viewerPage.goto('/');
 *     await expect(viewerPage.getByText('閲覧者 (Viewer) はエクスポート')).toBeVisible();
 *   });
 *
 * 各 fixture は対応する storageState ファイルが存在しない場合に skip する.
 */

const authDir = path.join(process.cwd(), 'playwright', '.auth');

type Fixtures = {
  ownerPage: Page;
  adminPage: Page;
  editorPage: Page;
  reviewerPage: Page;
  viewerPage: Page;
  /** 認証なしの新規 Page (公開ランディング検証用) */
  guestPage: Page;
};

type AuthedFixtureKey = Extract<keyof Fixtures, 'ownerPage' | 'adminPage' | 'editorPage' | 'reviewerPage' | 'viewerPage'>;

async function makeAuthedPage(
  browser: import('@playwright/test').Browser,
  role: AuthedFixtureKey,
  use: (page: Page) => Promise<void>,
): Promise<void> {
  const stateFile = path.join(authDir, `${role.replace(/Page$/, '')}.json`);
  const fs = await import('fs');
  if (!fs.existsSync(stateFile)) {
    base.skip(true, `storageState ${stateFile} not found — run auth.setup first`);
    return;
  }
  const context = await browser.newContext({ storageState: stateFile });
  const page = await context.newPage();
  await use(page);
  await context.close();
}

export const test = base.extend<Fixtures>({
  ownerPage: async ({ browser }, use) => {
    await makeAuthedPage(browser, 'ownerPage', use);
  },
  adminPage: async ({ browser }, use) => {
    await makeAuthedPage(browser, 'adminPage', use);
  },
  editorPage: async ({ browser }, use) => {
    await makeAuthedPage(browser, 'editorPage', use);
  },
  reviewerPage: async ({ browser }, use) => {
    await makeAuthedPage(browser, 'reviewerPage', use);
  },
  viewerPage: async ({ browser }, use) => {
    await makeAuthedPage(browser, 'viewerPage', use);
  },
  guestPage: async ({ browser }, use) => {
    const context = await browser.newContext(); // no storageState
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
