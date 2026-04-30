# Flow Test Design — security-checklist-tool

**Document ID**: TEST-FLOW-20260430
**Phase**: 2 (Design)
**Framework**: Playwright (multi-actor 対応)
**Scope**: ロール横断のジャーニー、複数アクター協働

---

## 1. ロール定義 (テスト用)

| Role | テストアカウント |
|------|---------------|
| owner | `owner@tenant-a.test` |
| admin | `admin@tenant-a.test` |
| editor | `editor1@tenant-a.test`, `editor2@tenant-a.test` |
| reviewer | `reviewer@tenant-a.test` |
| viewer | `viewer@tenant-a.test` |

別テナント: `owner@tenant-b.test` (分離テスト用)

<!-- END SECTION 1 -->

## 2. ジャーニー: 医療系SaaS 完全フロー (4ロール協働)

### F-01: Owner → Admin → Editor → Reviewer → Viewer

```
Step 1 [Owner]:
  - 新規テナント作成 (CC-Auth)
  - admin@tenant-a を Admin で招待

Step 2 [Admin]:
  - editor1, editor2, reviewer, viewer を招待 (各ロール)
  - URL `https://example-medical-saas.jp` を分析
  - 推定確認 → 一部修正 (pii=true 確定)
  - 「2026Q2 病院審査向け」シート生成

Step 3 [Editor1]:
  - P0 項目 5件を担当
  - status=in_progress、メモ「証跡準備中」
  - AIチャット「医療情報のアクセスログ要件」 → 回答取得
  - Good 評価

Step 4 [Editor2]:
  - 同シートの P1 項目 10件を担当
  - 期限を 2026-06-30 設定
  - 証跡URL登録 (社内Wiki)
  - status=done

Step 5 [Reviewer]:
  - status=done の項目を確認
  - 一部に note 追記「証跡確認済み」
  - status 変更を試行 → 403 (RBAC)
  - AI回答 Good/Bad 評価

Step 6 [Owner/Admin]:
  - 進捗ドーナツ確認 (P0 0%, P1 100%)
  - PDF/Excel エクスポート

Step 7 [Viewer]:
  - 過去のassessmentをログイン後ロードのみで開く
  - S1 input disabled, S3 read-only
  - CSV エクスポート → ダウンロード
  - 編集試行 → 全箇所403/ disabled
```

期待時間: **15分以内** (シナリオ全体)。

<!-- END SECTION 2 -->

## 3. ジャーニー: 製造業 OT/IT (Editor 単独 + Admin監査)

### F-02

```
Step 1 [Admin]: テナント作成 + Editor 招待
Step 2 [Editor]: 製造業URL 分析 → 経産省工場CPSF 採用
Step 3 [Editor]: OT領域 「ネットワーク分離」AIチャット
Step 4 [Editor]: 担当=外部委託先「OT管理課」、期限を四半期末
Step 5 [Admin]: AuditLog で Editor の操作を確認
Step 6 [Editor]: 月次でステータス更新
Step 7 [Admin]: PDF エクスポートで親会社報告
```

<!-- END SECTION 3 -->

## 4. ジャーニー: ISMS 初期診断 (自治体)

### F-03

```
Step 1 [Owner=Admin]: 単独運用シナリオ
Step 2: 自治体ドメイン URL 分析 → 総務省 + J-LIS + IPA-SME
Step 3: アクセス制御 / 物理 / BCP の3カテゴリでフィルタ
Step 4: 担当別ビューで 「未対応」項目を集計
Step 5: PDF 経営会議資料化
```

<!-- END SECTION 4 -->

## 5. テナント分離フロー

### F-04

```
Step 1 [Tenant A Owner]: assessment X 作成
Step 2 [Tenant B Owner]: 別テナントログイン
Step 3: assessment X の URL を直接アクセス (ID 推測)
   → 404 not_found
Step 4: API 経由で /assessments/<X> を直接叩く
   → 404 (tenantId mismatch)
Step 5: 監査ログ確認
   → Tenant A の操作が Tenant B に見えない
```

<!-- END SECTION 5 -->

## 6. マスタ更新フロー (四半期)

### F-05

```
Step 1 [Owner/Admin]: マスタv1.1 をimport (CSV)
Step 2: System: 新 guideline_version 作成 (旧と共存)
Step 3 [Admin]: 既存assessment が旧版で動作継続を確認
Step 4 [Admin]: 新規assessment 生成 → 自動的に v1.1 採用
Step 5 [User全員]: 画面上部にバナー「ガイドライン更新あり」
```

<!-- END SECTION 6 -->

## 7. 障害復旧フロー

### F-06: LLM プロバイダ全停

```
Step 1 [Editor]: AIチャット → サーキットブレーカー open
Step 2: UI: 「AI機能一時停止中」バナー
Step 3: 別の操作 (status変更, メモ) は正常動作
Step 4: 30分後にプロバイダ復旧 → サーキットブレーカー close
Step 5: AIチャット再開
```

### F-07: Crawler timeout

```
Step 1 [Editor]: 重い外部サイトを URL投入
Step 2: 10秒で timeout → 502
Step 3: UI: 「手動入力」フォールバック表示
Step 4 [Editor]: industry/size を手動入力 → assessment 生成成功
```

<!-- END SECTION 7 -->

## 8. 運用フロー (CC-Auth)

### F-08

```
Step 1: localhost:3000 / dev / prod の3環境で同一ジャーニー
Step 2: dev 環境のみ MFA 任意, prod は Admin 必須
Step 3: SSO切り替え (組織アカウント) → tenant 自動マッピング
```

<!-- END SECTION 8 -->

## 9. 同時編集

### F-09

```
Step 1 [Editor1]: 項目X を status=in_progress に変更
Step 2 [Editor2 同時]: 同項目を status=done に変更
Step 3: 後勝ち + トースト警告 + audit_log 両方記録
Step 4: 表示は最新値で同期 (polling/SSE)
```

<!-- END SECTION 9 -->

## 10. 実行・成功判定

```bash
/test --mode flow --env local   # docker-compose で全コンポーネント起動
```

成功条件:
- 全 F-XX が PASS
- 各ロールの操作が 期待通り (RBAC violations が出ない、出るべき箇所では 403 が出る)
- AuditLog に 期待件数のレコードあり
- E2E 録画 video があれば後追い可能

<!-- END SECTION 10 -->

---

*CCAGI SDK Phase 2 — Flow Test Design (TEST-FLOW-20260430)*
