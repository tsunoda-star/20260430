import { describe, it } from 'vitest';

/**
 * F-02: 製造業 OT/IT (Editor 単独 + Admin 監査) フロー.
 * flow-test-design.md §3 に対応。
 *
 * 想定 Step:
 *   1. Editor が Company 推定 + Assessment 作成 (auto baseline)
 *   2. Editor が複数 AssessmentItem の status / note / evidenceUrl を更新
 *   3. Reviewer が status=done の項目に note 追記 + Good/Bad 評価
 *   4. Reviewer は status!=done の項目を更新できない (403 forbidden)
 *   5. Admin が監査ログを CSV エクスポート
 *
 * Cycle 5.4 完了時には実 DB + 認可ガード + AuditLog を一気通貫で検証する。
 */

describe('F-02: manufacturing OT/IT collaboration flow', () => {
  it.todo('editor creates assessment and updates status/note/evidence');
  it.todo('reviewer adds note + Good/Bad on done items');
  it.todo('reviewer is rejected with 403 on non-done items');
  it.todo('admin exports audit logs as CSV');
});
