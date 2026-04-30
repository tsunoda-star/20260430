# E2E Tests (Phase 5 / Cycle 5.3)

Playwright を用いた end-to-end スイート. 5 ロール × 主要操作 マトリクス + Viewer 専用フロー + SSE 検証.

## 前提

- Node.js 20+ / `@playwright/test` 導入済み
- Cognito User Pool に 5 ロール分のテストユーザー (env で資格情報指定)
- ローカル DB & Next.js dev サーバ (もしくは AWS dev 環境)

## 必要環境変数

```bash
# Base URL (ローカル既定 http://localhost:3000)
export BASE_URL=http://localhost:3000

# 5 ロール分の Cognito テストアカウント
export TEST_OWNER_EMAIL="owner@example.com"
export TEST_OWNER_PASSWORD="..."
export TEST_ADMIN_EMAIL="admin@example.com"
export TEST_ADMIN_PASSWORD="..."
export TEST_EDITOR_EMAIL="editor@example.com"
export TEST_EDITOR_PASSWORD="..."
export TEST_REVIEWER_EMAIL="reviewer@example.com"
export TEST_REVIEWER_PASSWORD="..."
export TEST_VIEWER_EMAIL="viewer@example.com"
export TEST_VIEWER_PASSWORD="..."

# AI チャット SSE テスト用 (DB に seeded されている AssessmentItem ID)
export TEST_ASSESSMENT_ITEM_ID=1
```

## 実行手順

```bash
# 1. Playwright ブラウザバイナリインストール (初回のみ)
npx playwright install --with-deps chromium

# 2. テスト DB を起動 + 27 ガイドライン seed
docker compose up -d postgres
DATABASE_URL="postgresql://sct:sct_pw@localhost:5432/security_checklist_tool?schema=public" \
  npx prisma migrate deploy
DATABASE_URL="..." npm run prisma:seed

# 3. dev server 起動 (別ターミナル)
npm run dev

# 4. E2E 実行
npx playwright test                # 全 spec
npx playwright test landing.pw     # 単一 spec
npx playwright test --headed       # 画面表示付き
npx playwright show-report         # HTML レポート閲覧

# 5. 単体ロールのみ
npx playwright test viewer-flow.pw
```

## 構成

```
tests/e2e/
├── README.md           ← 本ファイル
├── auth.setup.ts       ← 5 ロール × Cognito Hosted UI ログイン → storageState 保存
├── fixtures/index.ts   ← ownerPage / adminPage / editorPage / reviewerPage / viewerPage / guestPage
├── global-setup.ts     ← .test-logs ディレクトリ + latest シンボリックリンク
├── global-teardown.ts  ← metadata.json に終了時刻を追記
├── landing.pw.ts       ← 認証不要のランディング + URL 入力フォーム validation
├── viewer-flow.pw.ts   ← Banner + ExportCta + redirect + 403 forbidden
├── role-matrix.pw.ts   ← 5 ロール × 5 主要 API の許可マトリクス検証
├── sse-progress.pw.ts  ← POST /companies/stream の SSE 受信
└── ai-chat.pw.ts       ← POST /assessment-items/[id]/ai-chat の SSE 受信
```

## Cycle 5.3 完了に向けた追加対象 (TODO)

- ガイドラインインポート flow (CSV/JSON UI 経由)
- ダッシュボード集計値の UI 上表示確認
- マスタ更新通知バナーの表示/抑制
- Reviewer assignments card の表示 (ReviewerAssignmentsCard)
- マルチブラウザ並列 (chromium / firefox / webkit / mobile) でのレグレッションテスト
- ロケータの aria-label を増やしてアクセシビリティ準拠を強化

## トラブルシューティング

| エラー | 対処 |
|--------|------|
| `auth.setup` が skip される | TEST_<ROLE>_EMAIL/PASSWORD 環境変数を設定 |
| `storageState ... not found` | `auth.setup` を一度成功させて playwright/.auth/*.json を生成 |
| `Browser closed` | `npx playwright install --with-deps` を実行 (CI 環境ではOSパッケージも) |
| Hosted UI セレクタ不一致 | Cognito UI のテンプレートが変更された場合は `loginThroughHostedUI` 内の getByLabel/getByRole を調整 |

---
Phase 5 / Cycle 5.3 — Playwright Suite (security-checklist-tool)
