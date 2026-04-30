import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Cycle 5.3 / spec.md §6.2: 5 ロール × 主要操作 のマトリクス E2E.
 *
 * 各 (ロール, アクション) の組み合わせで API を叩き、許可ロールは 2xx,
 * 不許可ロールは 403 forbidden を期待値として比較する。
 *
 * Pre-conditions: 5 ロール分の playwright/.auth/*.json が生成済み.
 *                 サーバ側で対象 tenant にあらかじめ Company / Assessment が
 *                 シード投入されている必要があるため、本ファイルでは API
 *                 形式のみ検証 (実 ID を要求しないエンドポイント中心)。
 */

interface ApiCheck {
  name: string;
  call: (page: Page) => Promise<number>;
  allow: ReadonlyArray<'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer'>;
}

const CHECKS: ApiCheck[] = [
  {
    name: 'POST /api/v1/companies',
    call: async (page) => {
      const res = await page.request.post('/api/v1/companies', {
        data: { url: 'https://example.com' },
      });
      return res.status();
    },
    allow: ['owner', 'admin', 'editor'],
  },
  {
    name: 'POST /api/v1/companies/stream',
    call: async (page) => {
      const res = await page.request.post('/api/v1/companies/stream', {
        data: { url: 'https://example.com' },
      });
      return res.status();
    },
    allow: ['owner', 'admin', 'editor'],
  },
  {
    name: 'GET /api/v1/admin/audit-logs',
    call: async (page) => {
      const res = await page.request.get('/api/v1/admin/audit-logs');
      return res.status();
    },
    allow: ['owner', 'admin'],
  },
  {
    name: 'POST /api/v1/admin/users/invite',
    call: async (page) => {
      const res = await page.request.post('/api/v1/admin/users/invite', {
        data: { email: 'test@example.com', role: 'editor' },
      });
      return res.status();
    },
    allow: ['owner', 'admin'],
  },
  {
    name: 'POST /api/v1/admin/guidelines/import',
    call: async (page) => {
      const res = await page.request.post('/api/v1/admin/guidelines/import', {
        data: [],
      });
      return res.status();
    },
    allow: ['owner', 'admin'],
  },
];

function expectStatus(allowed: boolean, status: number): void {
  if (allowed) {
    // 2xx (成功) もしくは 422 (URL_BLOCKED) / 400 (zod) は "認可は通過した" とみなす
    expect([200, 201, 202, 400, 404, 409, 422].includes(status)).toBe(true);
  } else {
    expect(status).toBe(403);
  }
}

test.describe('role × action matrix', () => {
  for (const check of CHECKS) {
    test(`${check.name} respects matrix`, async ({
      ownerPage,
      adminPage,
      editorPage,
      reviewerPage,
      viewerPage,
    }) => {
      const pages = {
        owner: ownerPage,
        admin: adminPage,
        editor: editorPage,
        reviewer: reviewerPage,
        viewer: viewerPage,
      } as const;
      for (const [role, page] of Object.entries(pages) as Array<
        [keyof typeof pages, Page]
      >) {
        const status = await check.call(page);
        const allowed = check.allow.includes(role);
        expectStatus(allowed, status);
      }
    });
  }
});
