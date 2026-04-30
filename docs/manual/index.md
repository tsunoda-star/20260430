# User Manual — security-checklist-tool

**Generated**: 2026-04-30 (Phase 6 / Cycle 6.3)
**Audience**: 5 ロール × 想定ユーザー

---

## 1. ロール別マニュアルへ

ご自身のロールに合わせてマニュアルをご覧ください。所属組織で割り当てられたロールが分からない場合は管理者 (Owner / Admin) にご確認ください。

| ロール | 想定ユーザー | マニュアル |
|--------|-------------|-----------|
| Owner | テナントオーナー / 課金担当 | [owner.md](./owner.md) |
| Admin | システム管理者 | [admin.md](./admin.md) |
| Editor | 情報セキュリティ担当者 | [editor.md](./editor.md) |
| Reviewer | 確認者 (社内監査 / コンプラ) | [reviewer.md](./reviewer.md) |
| Viewer | 取引先審査担当 / 経営層 / 監査法人 | [viewer.md](./viewer.md) |

---

## 2. 5 ロール 操作早見表 (spec.md §6.2 SSOT)

| 操作 | Owner | Admin | Editor | Reviewer | Viewer |
|------|:-----:|:-----:|:------:|:--------:|:------:|
| URL入力・分析開始 | ✓ | ✓ | ✓ | × | × |
| 企業プロフィール編集 | ✓ | ✓ | × | × | × |
| 評価シート新規作成 | ✓ | ✓ | ✓ | × | × |
| 評価シート削除 | ✓ | ✓ | × | × | × |
| ステータス変更 | ✓ | ✓ | ✓ | × | × |
| メモ・証跡登録 | ✓ | ✓ | ✓ | △ (note追記) | × |
| 担当・期限割当 | ✓ | ✓ | ✓ | × | × |
| AIチャット利用 | ✓ | ✓ | ✓ | ✓ (read-only Q) | × |
| AI Good/Bad 評価 | ✓ | ✓ | ✓ | ✓ | × |
| ユーザー招待・ロール変更 | ✓ | ✓ | × | × | × |
| エクスポート (Excel/PDF/CSV) | ✓ | ✓ | ✓ | ✓ | ✓ |
| 閲覧 (read all) | ✓ | ✓ | ✓ | ✓ | ✓ |
| マスタ更新 (admin/import) | ✓ | ✓ | × | × | × |
| 監査ログ参照 | ✓ | ✓ | × | × | × |

`△ note追記`: Reviewer は status=done の項目に対して note 追記のみ可能。

---

## 3. 共通画面 (S0〜S8)

| ID | 画面 | 主要操作 |
|----|------|---------|
| S0 | ログイン (CC-Auth) | OIDC リダイレクト |
| S1 | トップ (URL入力) | URL分析開始 / 履歴から再開 |
| S2 | 分析結果・属性確認 | 推定確認 / 手動修正 / シート生成 |
| S3 | チェックシート一覧 | フィルタ / ソート / 行選択 |
| S4 | 項目詳細 + AIチャット (右ペイン) | ステータス・メモ・期限・証跡 / AI質問 |
| S5 | 設定・出力 | プロフィール編集 / Excel/PDF/CSV エクスポート |
| S6 | ダッシュボード (P2) | 進捗ドーナツ / 期限超過 / カテゴリヒートマップ |
| S7 | ユーザー管理 (Admin) | 招待・ロール変更 |
| S8 | マスタ管理 (Admin/Owner) | ガイドライン版確認・更新 |

詳細は [spec.md §5](../design/spec.md#5-画面定義).

---

## 4. ログインの流れ (全ロール共通)

1. ブラウザで本サービスの URL を開く (S0 ログイン画面)
2. 「ログイン」ボタンを押すと CC-Auth (Cognito) のログイン画面へリダイレクト
3. Email + Password を入力
4. 認証成功で S1 トップ画面へ
5. ログアウトはヘッダー右上 (Phase 7 で実装予定)

---

## 5. 困ったときは

| 症状 | 対処 |
|------|------|
| ログインできない | Email / Password を再確認 → 解決しなければ Owner/Admin に問い合わせ |
| 「権限不足」と表示される | 該当ロールでは未許可の操作。上位ロールへ依頼 |
| URL 入力で `422 url_blocked` | 内部 IP / metadata エンドポイント等は解析不可 (SSRF 防御) |
| AI チャットが「AI機能が一時停止中です」 | LLM プロバイダ側の障害。手動入力で対応継続可能 |
| エクスポートが失敗する | リトライ / Admin に連絡 |

---

## 6. 関連ドキュメント

- API リファレンス: [`docs/api/api-reference.md`](../api/api-reference.md)
- システム構成: [`docs/architecture/system.md`](../architecture/system.md)
- UX レビュー: [`docs/UX-REVIEW/`](../UX-REVIEW/)

---
*Phase 6 / Cycle 6.3 — User Manual Index (security-checklist-tool)*
