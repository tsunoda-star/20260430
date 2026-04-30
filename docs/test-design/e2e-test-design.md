# E2E Test Design — security-checklist-tool

**Document ID**: TEST-E2E-20260430
**Phase**: 2 (Design)
**Framework**: Playwright + Docker Compose (full stack)
**Environments**: local / dev / prod (read-only smoke)

---

## 1. テスト環境

```
docker-compose.yml:
  - app (Next.js, port 3000)
  - postgres (Testcontainers compatible)
  - localstack (S3, SQS)
  - mock-llm (Express + MSW for offline mode)
  - mock-cc-auth (JWT発行)
```

`/test --mode e2e --env local` で起動。`--env dev` の場合は AWS dev 環境に対して smoke テストのみ。

<!-- END SECTION 1 -->

## 2. ハッピーパス (主要シナリオ)

### 2.1 E2E-01: 医療系SaaS (Persona B 鈴木)

```
1. CC-Auth でログイン (admin role)
2. S1: URL `https://example-medical-saas.jp` 入力 → 「分析開始」
3. プログレス → S2 へ自動遷移
4. 推定属性 確認: industry=medical-saas, pii=true
5. 候補ガイドライン: IPA-SME, METI-MGMT, NIST-CSF-2, 厚労省医療情報 をすべて選択
6. 「シート生成」 → S3 へ
7. 進捗ドーナツ 0% 表示
8. P0 priority でフィルタ → 行クリック
9. S4 ドロワー: ステータス → completed, メモ「証跡: 社内Wiki」, 証跡URL登録
10. AI質問: 「医療情報のアクセスログ要件は？」 → SSE stream 受信
11. Good 評価
12. S5: PDFエクスポート → ダウンロード成功
13. ファイルサイズ > 0、PDF magic bytes 確認
```

期待時間: **5分以内** (LLM mockで)

### 2.2 E2E-02: 製造業 (Persona A 田中)

```
1. ログイン (editor)
2. URL `https://example-manufacturing.co.jp`
3. industry=manufacturing 推定
4. 経産省 工場CPSF + baseline → シート生成
5. OT項目に 担当=「OT管理課 山田」, 期限=2026-06-30 設定
6. AIチャット「IEC 62443 ゾーン分割の例」
7. Excel エクスポート → ダウンロード + シート読み込み確認
```

### 2.3 E2E-03: 自治体外郭団体 (Persona C 佐藤)

```
1. ログイン (admin)
2. URL自治体ドメイン → industry=local-government
3. 総務省 + J-LIS + IPA-SME 自動選定
4. ISMS関連項目 (アクセス制御 / 物理 / BCP) を 担当別フィルタ
5. PDF エクスポート → 経営会議資料化
```

<!-- END SECTION 2 -->

## 3. ロール別ジャーニー

### 3.1 Owner

- 全機能 (E2E-01相当) + ユーザー招待 + マスタ参照

### 3.2 Admin

- E2E-01 と同等 + ユーザー招待

### 3.3 Editor

- URL入力 + シート生成 + 項目編集 + エクスポート
- ❌ 削除 → 403確認

### 3.4 Reviewer

- 完了候補レビュー: status=done の項目を確認、note追記、Good/Bad 評価
- ❌ status変更 → 403

### 3.5 Viewer (エクスポート専用)

```
1. ログイン (viewer)
2. S1: URL入力欄 disabled、履歴から既存assessment選択
3. S3: read-only テーブル、行クリックでトースト「閲覧専用」
4. S5: Export ボタンのみ → CSV ダウンロード
```

<!-- END SECTION 3 -->

## 4. 異常系シナリオ

| ID | シナリオ | 期待 |
|----|--------|------|
| E-X-01 | URL入力 → サーバー側でcrawler timeout 10s | 「手動入力」フォールバックUI |
| E-X-02 | LLM 5xx 連続 | サーキットブレーカー → 「AI機能一時停止」バナー、それでも assessment は ルールベースのみで生成可能 |
| E-X-03 | export 失敗 (DLQ) | 「再試行する」ボタン + 失敗ログ |
| E-X-04 | session 期限切れ中の編集 | 401 → ログイン画面 + 編集中データ保持 (localStorage 復元) |
| E-X-05 | 同時編集衝突 (2タブ) | 後勝ち + トースト警告 |

<!-- END SECTION 4 -->

## 5. SSRF E2E

| ID | URL投入 | 期待 |
|----|--------|------|
| E-S-01 | `http://169.254.169.254/...` | UI: 422 「内部ネットワーク参照は不可」 |
| E-S-02 | `http://10.0.0.1` | 同上 |
| E-S-03 | redirect → IMDS | 同上 (hop2 でブロック) |
| E-S-04 | `file:///etc/passwd` | 入力時 client validation |

<!-- END SECTION 5 -->

## 6. パフォーマンス E2E

| 指標 | 計測ポイント | 目標 |
|------|------------|------|
| URL投入 → S2 表示 | playwright timing | 30s 95%ile (PRD §9) |
| AIチャット 初トークン | SSE 開始 | 10s |
| 通常画面遷移 | navigation | 500ms |
| PDF export 200項目 | export status=ready | 15s |
| Lighthouse Performance | local | 90+ |

<!-- END SECTION 6 -->

## 7. データオプトアウト契約検証

| ID | 検証 | 期待 |
|----|------|------|
| E-D-01 | LLM mock の req body スナップショット | note/evidence_url が含まれない |
| E-D-02 | OpenAI ヘッダ (本番設定) | `OpenAI-Beta: log-retention=0` |
| E-D-03 | Bedrock invoke 設定 | `enable_logging=false` |

<!-- END SECTION 7 -->

## 8. 録画・スクリーンショット

- 全テスト失敗時に video 自動保存 (`.test-logs/<ts>/browser/videos/`)
- 主要 happy-path は成功でも screenshot を保存
- network HAR 出力で SSRF 検知の調査支援

<!-- END SECTION 8 -->

## 9. 並列度・実行時間

- shard 4 並列、E2E 全体で 約 20分
- CI は PR で smoke (E2E-01のみ)、main マージ後に full E2E

<!-- END SECTION 9 -->

---

*CCAGI SDK Phase 2 — E2E Test Design (TEST-E2E-20260430)*
