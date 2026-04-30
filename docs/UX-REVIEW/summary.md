# UX レビュー サマリー — security-checklist-tool

**Document ID**: UX-SUMMARY-20260430
**Phase**: 3 (Planning) Deliverable
**Project**: security-checklist-tool
**Created**: 2026-04-30
**Phase 3 Issue**: https://github.com/tsunoda-star/20260430/issues/4
**SSOT Issue**: https://github.com/tsunoda-star/20260430/issues/5

---

## 1. レビュー範囲

Phase 1 〜 Phase 2 成果物を入力に、以下7観点で UX レビューを実施:

1. カスタマージャーニー (5ロール × 主要シナリオ) — [journey-map.md](./journey-map.md)
2. Viewer 専用フロー — [viewer-export-flow.md](./viewer-export-flow.md)
3. confidence < 50% の UX — [confidence-ux.md](./confidence-ux.md)
4. SSE 体感速度 (進捗・cancel・retry) — [sse-feedback.md](./sse-feedback.md)
5. 5ロール権限可視化 — journey-map.md §7 + viewer-export-flow.md
6. アクセシビリティ (WCAG 2.2 AA) — [accessibility-audit.md](./accessibility-audit.md)
7. レスポンシブ — accessibility-audit.md §5

---

## 2. 総合評価

| 評価軸 | 評価 | コメント |
|--------|------|---------|
| 要件カバレッジ | Excellent | Phase 1 機能要件 20件 / 受け入れ条件 8件すべてに UX 観点を割当 |
| 設計整合性 | Good | Phase 2 spec.md (5ロール / SSRF / SSE / LLM) と矛盾なし |
| ロール拡張対応 | Good | Phase 1 (3ロール) → Phase 2 (5ロール) の上位互換性を確認 |
| アクセシビリティ | Needs Improvement | White on Sky Blue (3.4:1) の使用範囲を明確化要 (大文字限定) |
| AI slop 回避 | Good | 禁止フォント/カラー/エフェクトに違反なし |
| 差別化要素 | Good | URL一画面起点UX (Hmhm参照) が一貫している |

**総合**: Phase 4 着手 GO。High Severity 8件、Medium 6件、Low 4件。Phase 2 への差し戻しは 0件。

---

## 3. 検出 Issue 一覧

### 3.1 High Severity (Phase 4 で対応必須 / 8件)

| ID | カテゴリ | Issue | 対応 Cycle |
|----|---------|-------|----------|
| H-01 | Viewer 専用UI | S1' Viewer ホーム (Card レイアウト + エクスポート CTA 直接配置) | Cycle 3.3 |
| H-02 | 権限可視化 | 全 disabled ボタンに `aria-describedby` + tooltip (理由明示) | Cycle 3.2 / 3.3 |
| H-03 | confidence | confidence ≥80 / 50-79 / <50 の3層 UI 差別化 (バッジ色 / border / CTA 優先度) | Cycle 2.3 / 2.4 |
| H-04 | confidence | 警告バナー (persistent) + 手動修正モーダル + AI質問モード切替 | Cycle 2.3 / 2.4 |
| H-05 | SSE | クロール 5段階進捗 + cancel + retry (失敗種別ごと動作) | Cycle 3.4 |
| H-06 | SSE | AI チャット streaming + cancel (中断時に途中保存) | Cycle 3.1 / 3.4 |
| H-07 | A11y | White on Sky Blue 大文字限定使用 (本文では Deep Navy/Charcoal 限定) | Cycle 1.2 |
| H-08 | A11y | Skip to content + `:focus-visible` 2px ring + Lighthouse/axe-core CI | Cycle 1.1 / 1.2 |

### 3.2 Medium Severity (Phase 4 推奨 / 6件)

| ID | カテゴリ | Issue | 対応 Cycle |
|----|---------|-------|----------|
| M-01 | Editor UX | デフォルトフィルタ「assignee=me」で自分宛優先表示 | Cycle 3.1 |
| M-02 | Reviewer | note 追記モード (既存 read-only / 末尾追記) | Cycle 3.5 |
| M-03 | 権限差バナー | 「あなたは Viewer です」3回まで自動表示、localStorage で抑制 | Cycle 3.3 |
| M-04 | SSE | Esc キーボードショートカット (cancel) | Cycle 3.4 |
| M-05 | エクスポート | グローバルナビに mini progress (バックグラウンド継続) | Cycle 4.1 |
| M-06 | 招待UX | 招待 deep link → Assessment 直接遷移 | Cycle 3.2 |

### 3.3 Low Severity (任意 / 4件)

| ID | カテゴリ | Issue | 対応 Cycle |
|----|---------|-------|----------|
| L-01 | confidence | 質問テンプレート3つ提示 (confidence<50 時) | Cycle 3.1 |
| L-02 | エクスポート | 平均時間メトリクス表示 (DB 中央値) | Cycle 4.1 |
| L-03 | Owner | 課金導線 (Phase 8 連携) | Phase 8 |
| L-04 | Editor | 証跡URL ドラッグ&ドロップ登録 | Cycle 4.1 (P2) |

### 3.4 Phase 2 差し戻し (0件)

差し戻し不要。Phase 2 設計はそのまま Phase 4 へ進行可能。

### 3.5 Phase 5.5 で検証 (品質ゲート / 7件)

| ID | カテゴリ | 検証項目 | ツール |
|----|---------|---------|-------|
| Q-01 | A11y | WCAG 2.2 AA 違反 0件 | axe-core / Lighthouse |
| Q-02 | A11y | コントラスト比 4.5:1 以上 (本文) | color-contrast-analyzer |
| Q-03 | A11y | 全 disabled に aria-describedby | axe-core |
| Q-04 | UI quality | 禁止フォント (Inter/Roboto/Arial) 0件 | /ui-skills |
| Q-05 | UI quality | 禁止カラー (紫グラデ on 白) 0件 | /ui-skills |
| Q-06 | Animation | アニメーション 200ms 以下 / compositor props のみ | /ui-skills |
| Q-07 | Performance | Lighthouse Performance 90+ / Accessibility 100 | /test --mode e2e |

---

## 4. 改善提案の分類サマリー

| 分類 | 件数 |
|------|-----|
| Phase 4 で対応 (High/Medium/Low) | 18件 |
| Phase 5.5 で検証 (品質ゲート) | 7件 |
| Phase 2 差し戻し | 0件 |
| Phase 8 連携 (将来) | 1件 (L-03 課金導線) |

---

## 5. 3層整合性確認

Phase 1 design-requirements.md ↔ Phase 2 design-system.yml ↔ Phase 3 UX レビュー の整合性:

| 観点 | Phase 1 | Phase 2 | Phase 3 整合性 |
|------|---------|---------|--------------|
| カラーパレット | Deep Navy + CC Sky Blue | design-system.yml 反映 | 整合 (H-07 で大文字限定明示) |
| タイポグラフィ | Manrope + Noto Sans JP | tailwind.config.ts 想定 | 整合 (Q-04 で検証) |
| アニメーション | 200ms / compositor props | motion/react 設定 | 整合 (sse-feedback.md §6) |
| ロール | Admin/Editor/Viewer | Owner/Admin/Editor/Reviewer/Viewer | 整合 (上位互換) |
| アクセシビリティ | WCAG AA / 4.5:1 / 44px | spec.md 準拠 | 整合 (全7観点) |
| 一画面起点UX | Hmhm 参照 | S1 トップ画面 | 整合 (全ロール) |

**結論**: 3層に矛盾なし。Phase 4 は本 UX レビューを副ガイドとして実装可能。

---

## 6. Phase 4 への引き継ぎ

### 6.1 推奨実装順 (SSOT Issue #5 と整合)

```
Wave 1 (基盤): Next.js / Tailwind+shadcn / CC-Auth / Prisma / 共通基盤
Wave 2 (コア): URL投入 / SSRFクローラー / LLM推定 / シート生成 / マッピング
Wave 3 (コラボ): 項目詳細+AIチャット / 5ロール権限 / Viewer専用 / SSE進捗 / Reviewer
Wave 4 (仕上げ): エクスポート / 監査ログ / ダッシュボード / 管理画面 / A11y仕上げ
```

### 6.2 起動コマンド

```bash
/implement-app           # Wave 1〜4 全体
/ui-styling              # design-system.yml + UX レビュー併用
/responsive-design       # accessibility-audit.md §5 ベース
```

### 6.3 Phase 5/5.5 で検証する UX 要件

- 5ロール × 主要操作マトリクス (E2E)
- Viewer エクスポート専用フロー (Flow テスト)
- confidence<50 警告バナー表示 (GUI)
- SSE 進捗 5段階 (E2E)
- WCAG AA / Lighthouse 100 (Phase 5.5)

---

## 7. 関連ドキュメント

- [docs/requirements/](../requirements/) — Phase 1 要件
- [docs/design/](../design/) — Phase 2 設計
- [docs/test-design/](../test-design/) — Phase 2 テスト設計
- [Phase 3 Issue #4](https://github.com/tsunoda-star/20260430/issues/4)
- [SSOT Issue #5](https://github.com/tsunoda-star/20260430/issues/5)
- [Epic #2](https://github.com/tsunoda-star/20260430/issues/2)

<!-- END SECTION ALL -->
