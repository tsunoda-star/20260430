# カスタマージャーニーマップ — 5ロール × 主要シナリオ

**Document ID**: UX-JM-20260430
**Phase**: 3 (Planning)
**Source**: docs/requirements/requirements.md, docs/design/spec.md §5-6
**Project**: security-checklist-tool
**Created**: 2026-04-30

---

## 1. ジャーニー全体像

```
S0 ログイン → S1 トップ → S2 分析結果 → S3 シート一覧 → S4 項目詳細 → S5 設定/出力
              (URL入力)    (推定確認)    (フィルタ)     (AIチャット)   (エクスポート)
                                                                       
                                          + S6 ダッシュボード (P2)
                                          + S7 ユーザー管理 (Admin/Owner)
                                          + S8 マスタ管理 (Admin/Owner)
```

## 2. Owner: 鈴木 (経営企画役員 / SaaS スタートアップ)

**ペルソナ参照**: requirements.md §2 Persona B
**主要シナリオ**: テナント新規セットアップ → 病院導入審査向け対応

### ジャーニー

| Step | 画面 | 行動 | 感情 (PAD) | UX要件 |
|------|------|------|-----------|--------|
| 1 | S0 | CC-Auth ログイン (初回テナント作成) | 期待 (P+0.6, A+0.5) | OIDC リダイレクト 3秒以内、ロード状態明示 |
| 2 | S1 | URL `https://example-medical-saas.jp` 投入 | 集中 (P+0.4, A+0.7) | 入力フィールド即フォーカス、Enter 即送信 |
| 3 | S1→S2 | クローリング+推定 進捗表示 | 期待+不安 (P+0.2, A+0.8) | SSE 進捗バー / 「ヘルスケアSaaSを推定中...」ストリーミング |
| 4 | S2 | 推定結果 (industry: medical-saas, confidence: 78) 確認 | 安心 (P+0.7, A+0.4) | confidence ≥ 50 緑バッジ / rationale 折りたたみ |
| 5 | S2 | 「個人情報取扱: あり」を確認 → 「シート生成」 | 決断 (P+0.8, A+0.6) | CTA Deep Navy / Manrope 600 |
| 6 | S3 | 27ガイドライン中4件選定済み (IPA-SME / METI-MGMT / NIST-CSF-2 / 医療情報) | 達成 (P+0.9, A+0.5) | 「この企業に最適な X 個のガイドラインが選ばれました」モーメント |
| 7 | S4 | 「医療情報のアクセスログ要件」項目を AI に質問 (SSE) | 集中 (P+0.5, A+0.6) | 質問送信 → 200ms 以内に Skeleton → 1.5s で初トークン |
| 8 | S5 | PDF + Excel エクスポート → 病院審査担当へ送付 | 達成 (P+0.9, A+0.3) | エクスポート進捗モーダル / 完了通知 |

### Owner 固有 UX 要件
- テナント設定画面 (S7/S8) へのアクセス導線 (グローバルナビ)
- 課金/プラン情報の確認導線 (Phase 8 で実装、現状は CC-Auth リンク)
- Owner 譲渡フロー (S7 内 / Phase 4 では UI のみ、API は P3 優先度)

---

## 3. Admin: 田中 (情シス兼務 / 中堅製造業)

**ペルソナ参照**: requirements.md §2 Persona A
**主要シナリオ**: 取引先要請対応 → ユーザー招待 → 監査

### ジャーニー

| Step | 画面 | 行動 | 感情 (PAD) | UX要件 |
|------|------|------|-----------|--------|
| 1 | S7 | Editor 「OT管理課 山田」を招待 (email + role) | 任務 (P+0.5, A+0.4) | ロール選択 dropdown / 招待メール送信プレビュー |
| 2 | S1 | URL 投入 → 製造業 推定 | 集中 (P+0.4, A+0.5) | confidence < 50 警告時は 手動修正 dropdown |
| 3 | S2 | 「OT領域あり」を手動追加 → ガイドライン再選定 | 統制 (P+0.6, A+0.5) | PATCH /companies/:id 即時反映 |
| 4 | S3 | カテゴリ「アクセス制御」「OT」でフィルタ | 整理 (P+0.5, A+0.3) | フィルタ chip / URL クエリ同期 |
| 5 | S4 | 担当者「山田」期限「2026-06-30」を割当 | 委譲 (P+0.6, A+0.3) | アサイン dropdown / カレンダー picker |
| 6 | S6 | ダッシュボードで進捗確認 | 監督 (P+0.5, A+0.3) | 進捗ドーナツ / 期限超過バッジ |
| 7 | S7 | AuditLog 確認 (担当変更履歴) | 統制 (P+0.5, A+0.2) | フィルタ: action, user, date range |

### Admin 固有 UX 要件
- ユーザー管理 / 監査ログ 一覧へのナビ
- 招待状態 (pending/active/disabled) を一覧で確認
- ロール変更時の 確認モーダル (downgrade 時は警告)

---

## 4. Editor: 山田 (OT管理課 / 製造業)

**主要シナリオ**: アサインされた項目の対応進捗

### ジャーニー

| Step | 画面 | 行動 | 感情 (PAD) | UX要件 |
|------|------|------|-----------|--------|
| 1 | S0 | 招待メール → CC-Auth 初回ログイン | 緊張 (P+0.2, A+0.5) | 招待リンクから直接該当 Assessment へ deep link |
| 2 | S3 | 「自分の担当」フィルタで自分宛 12件を表示 | 整理 (P+0.4, A+0.4) | デフォルトフィルタ「assignee=me」 |
| 3 | S4 | 項目「アクセス制御の証跡」を AI に質問 | 学習 (P+0.5, A+0.5) | AI回答に AWS IAM 設定例 / "参考: <URL>" |
| 4 | S4 | 証跡URL「https://wiki.internal/...」を登録 | 達成 (P+0.6, A+0.3) | URL バリデーション / プレビュー |
| 5 | S4 | ステータス「対応中」→「完了」 | 達成 (P+0.7, A+0.2) | ステータス chip / クリック1回で変更 |
| 6 | S5 | Excel エクスポート (個人ぶん抜粋) | 任務完了 (P+0.7, A+0.2) | 「自分の担当のみ」出力オプション (Phase 4 P1) |

### Editor 固有 UX 要件
- 自分宛の項目を最優先表示 (デフォルトフィルタ)
- 証跡URL のドラッグ&ドロップ登録 (Phase 4 P2)
- AI チャット履歴を項目ごとに保持

---

## 5. Reviewer: 監査担当

**主要シナリオ**: 完了候補のレビュー

### ジャーニー

| Step | 画面 | 行動 | 感情 (PAD) | UX要件 |
|------|------|------|-----------|--------|
| 1 | S3 | フィルタ「status=done」 → レビュー待ち 24件 | 監査 (P+0.4, A+0.4) | デフォルトフィルタ「status=done & reviewer assigned」 |
| 2 | S4 | 証跡URL を新タブで確認 → 妥当性判断 | 集中 (P+0.5, A+0.5) | 証跡 URL は target=_blank + rel=noopener |
| 3 | S4 | note に追記「監査確認済み (2026-04-30)」 | 統制 (P+0.6, A+0.3) | note 追記モード (既存内容 read-only / 末尾に追記) |
| 4 | S4 | AI Good/Bad 評価 | 評価 (P+0.5, A+0.2) | 既存 Editor 評価と区別表示 |

### Reviewer 固有 UX 要件
- **read-only モード可視化**: ステータス変更ボタンを非表示、note は追記専用
- AI チャットは read-only で 質問のみ可 (新規回答は Editor 以上)
- レビュー対象を一覧化 (ダッシュボード S6 の Reviewer ビュー)

---

## 6. Viewer: 取引先審査担当 / 経営層

**主要シナリオ**: エクスポート専用フロー

### ジャーニー

| Step | 画面 | 行動 | 感情 (PAD) | UX要件 |
|------|------|------|-----------|--------|
| 1 | S0 | 招待メール → CC-Auth ログイン | 期待 (P+0.4, A+0.4) | 初回ログイン後 S5 (エクスポート) へ direct redirect オプション |
| 2 | S1 | URL 入力欄は **disabled** | 困惑 (P-0.1, A+0.3) | 「閲覧/エクスポートのみ可能です」バナー + S3 へのCTA |
| 3 | S3 | 一覧 read-only / フィルタは可 | 受容 (P+0.3, A+0.2) | 編集系ボタン非表示 (削除/ステータス変更/メモ) |
| 4 | S4 | 項目詳細 read-only | 受容 (P+0.3, A+0.2) | 入力フィールド全 disabled + ツールチップ「Editor以上の権限が必要」 |
| 5 | S5 | PDF / Excel / CSV エクスポート | 達成 (P+0.7, A+0.3) | **CTA を最大配置** / エクスポートのみ目立たせる |

### Viewer 固有 UX 要件 (Critical)
- **エクスポート専用UI**: S1 トップ画面でも S5 への CTA を直接表示
- **disabled 理由可視化**: 全 disabled ボタンに tooltip「Viewer の権限では実行できません。Admin に変更を依頼してください」
- **誤操作防止**: 編集系ボタンは非表示が原則 (disabled は補助)
- **権限差バナー**: 「あなたは Viewer です — 閲覧とエクスポートが可能です」常時表示 (dismiss可)
- 詳細は [viewer-export-flow.md](./viewer-export-flow.md)

---

## 7. ロール × 画面マトリクス (UX 観点)

| 画面 | Owner | Admin | Editor | Reviewer | Viewer |
|------|:-----:|:-----:|:------:|:--------:|:------:|
| S0 ログイン | full | full | full | full | full |
| S1 トップ (URL入力) | full | full | full | read-only | **エクスポートCTA** |
| S2 分析結果 | full | full | full | read-only | hidden |
| S3 シート一覧 | full | full | full | full (filter on done) | read-only + export |
| S4 項目詳細 | full | full | full | note追記+評価のみ | read-only |
| S5 設定/出力 | full | full | export | export | **export only** |
| S6 ダッシュボード | full | full | view | view | view |
| S7 ユーザー管理 | full | full | hidden | hidden | hidden |
| S8 マスタ管理 | full | full | hidden | hidden | hidden |

---

## 8. 共通 UX 原則

1. **一画面起点UX** (Hmhm 参照): S1 は URL 入力に集中、その他要素は最小化
2. **滑らかな状態遷移**: 200ms 以下のアニメーション、compositor props のみ
3. **権限差の透明化**: disabled 理由を必ず可視化、信頼境界はサーバー
4. **データ重視**: 装飾を抑え、チェックシート本体を主役に
5. **アクセシビリティ**: WCAG AA / コントラスト 4.5:1 / 44px touch / aria-label

---

## 9. Phase 4 への提案

| 優先度 | 提案 | 対応Cycle |
|-------|------|----------|
| High | Viewer 専用ナビゲーション (S1 → S3 → S5) | Cycle 3.3 |
| High | disabled 理由ツールチップ | Cycle 3.2 |
| High | Editor デフォルトフィルタ (assignee=me) | Cycle 3.1 |
| Medium | Reviewer note 追記モード | Cycle 3.5 |
| Medium | 招待 deep link → Assessment 直接遷移 | Cycle 3.2 |
| Low | Owner 課金導線 (Phase 8 連携) | Wave 4 / Phase 8 |

<!-- END SECTION ALL -->
