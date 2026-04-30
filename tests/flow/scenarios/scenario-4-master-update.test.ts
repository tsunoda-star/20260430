import { describe, it } from 'vitest';

/**
 * F-05: マスタ更新フロー (四半期).
 * flow-test-design.md §6 に対応。
 *
 * 想定 Step:
 *   1. 既存 Assessment が guidelineVersionSnapshot=v1.0 で保持
 *   2. Admin が POST /api/v1/admin/guidelines/import で v1.1 を投入
 *   3. GET /api/v1/master/latest-version が v1.1 を返却
 *   4. 既存 Assessment は v1.0 を継続使用 (snapshot 固定)
 *   5. 新規 Assessment は v1.1 で生成される
 *   6. UI 通知: MasterUpdateBanner が新版を検知
 *
 * Cycle 5.4 完了時には version snapshot が "凍結" される挙動を検証する。
 */

describe('F-05: master guideline update flow', () => {
  it.todo('imports new guideline version via POST /admin/guidelines/import');
  it.todo('latest-version endpoint reflects v1.1');
  it.todo('existing assessment keeps v1.0 snapshot');
  it.todo('new assessment is created on v1.1');
});
