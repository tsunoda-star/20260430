# 非機能要件定義書 — セキュリティ対策チェックシート生成ツール

**Document ID**: REQ-NF-20260428
**Version**: 1.0.0
**Source**: PRD-SEC-20260428 §9, §18, §19, §20
**Project**: security-checklist-tool
**Phase**: 1 (Requirements)
**Created**: 2026-04-30
**Author**: CodeGenAgent (源) via CoordinatorAgent (統)
**Epic Issue**: #2

---

## 1. 性能・パフォーマンス要件

| 項目 | 基準 | 計測方法 |
|------|------|---------|
| URL入力 → 初期分析結果+チェックシート表示 | **30秒以内** | E2Eテスト計測 (95パーセンタイル) |
| AIチャット応答 | **10秒以内** | フロントエンド `fetch` ストリーミング開始時間 |
| 通常画面遷移 (チェックシート → 項目詳細) | 500ms以内 | Lighthouse / RUM |
| エクスポート (Excel/PDF, 200項目) | 15秒以内 | サーバー処理時間 |
| 同時接続ユーザー数 | 500ユーザー (初期) → 5,000ユーザー (将来) | 負荷試験 |
| Core Web Vitals - FCP | < 1.8s | Lighthouse |
| Core Web Vitals - LCP | < 2.5s | Lighthouse |
| Core Web Vitals - CLS | < 0.1 | Lighthouse |
| Core Web Vitals - INP | < 200ms | Lighthouse |

<!-- END SECTION 1 -->

## 2. セキュリティ要件

### 2.1 通信・暗号化

| 項目 | 基準 |
|------|------|
| 通信プロトコル | HTTPS / TLS 1.2 以上 (TLS 1.3 推奨) |
| HSTS | 有効 (max-age=31536000; includeSubDomains) |
| 保存データ暗号化 | AES-256 (RDS at-rest, S3 SSE-S3 / SSE-KMS) |
| メモ・証跡URL の保管 | アプリ層で機微情報マスキング後に保存 |
| Cookie | Secure / HttpOnly / SameSite=Lax |

### 2.2 認証・認可

| 項目 | 基準 |
|------|------|
| 認証方式 | CC-Auth (Cognito User Pool 連携) |
| MFA | 推奨 (Admin必須) |
| セッション有効期間 | アクセストークン 1時間 / リフレッシュトークン 30日 |
| パスワードポリシー | CC-Auth 基準 (最低8文字 / 大小英数字 / 記号) |
| ロール制御 | Admin / Editor / Viewer の3層 (RBAC) |
| テナント分離 | TenantID による論理分離 (DB行レベル) |

### 2.3 アプリケーション・セキュリティ

| 項目 | 基準 |
|------|------|
| OWASP Top 10 (2021) 対応 | A01〜A10 すべての対策実施 |
| XSS対策 | フレームワーク標準エスケープ + CSP適用 |
| CSRF対策 | SameSite Cookie + CSRFトークン |
| SQL Injection | ORM パラメータバインディング徹底 |
| 入力URL の SSRF 対策 | プライベートIP帯 (10/8, 172.16/12, 192.168/16, 169.254/16) ブロック / メタデータエンドポイント (169.254.169.254) ブロック |
| LLM プロンプトインジェクション対策 | ユーザー入力のサニタイズ + システムプロンプト分離 |
| 外部依存スキャン | `npm audit` / Snyk / dependabot による継続監査 |
| シークレット管理 | AWS Secrets Manager / SSM Parameter Store (環境変数直書き禁止) |

### 2.4 LLM・AIプライバシー

| 項目 | 基準 |
|------|------|
| LLM API利用 | OpenAI等、データオプトアウト契約済みプロバイダ |
| プロンプト送信内容 | 企業ドメイン + 公開情報のみ (ユーザー登録メモ・証跡URL は送信しない、またはマスキング) |
| ハルシネーション対策 | 公的文書ソース誘導 + 断定回避プロンプト |
| 学習データ転用禁止 | プロバイダ契約で明示 |

<!-- END SECTION 2 -->

## 3. 可用性・信頼性要件

| 項目 | 基準 |
|------|------|
| 月間稼働率 (SLO) | **99.9%** (月43分以内のダウンタイム) |
| バックアップ | **1日1回**、保存期間 30日 (RDS自動スナップショット) |
| 災害復旧 (RPO) | 24時間 |
| 災害復旧 (RTO) | 4時間 |
| マルチAZ構成 | RDS + ALB + ECS Fargate (本番) |
| ヘルスチェック | ALB ターゲット 30秒間隔 / unhealthy 閾値 3回 |
| 監視 (アプリ) | エラーログ・API制限・応答遅延 (CloudWatch + Sentry) |
| 監視 (インフラ) | CPU / Memory / Disk / Network (CloudWatch Alarm) |
| アラート | Slack / メール通知 (P0: 即時, P1: 1時間以内) |

<!-- END SECTION 3 -->

## 4. 拡張性・スケーラビリティ要件

| 項目 | 基準 |
|------|------|
| 水平スケール | ECS Fargate Auto Scaling (CPU 70% トリガー) |
| 同時LLMリクエスト | 50 req/sec まで対応 (キュー方式 + リトライ) |
| ガイドラインマスタ規模 | 50ガイドライン × 平均500項目 = 25,000 ControlItem |
| Assessment保管規模 | 1,000テナント × 平均10シート = 10,000 Assessment |
| ストレージ拡張 | S3 (証跡URLからのキャプチャ画像保存も将来想定) |

<!-- END SECTION 4 -->

## 5. 対応環境・互換性要件

### 5.1 ブラウザ

| ブラウザ | バージョン |
|---------|-----------|
| Google Chrome | 最新版 + 1つ前 |
| Microsoft Edge | 最新版 + 1つ前 |
| Apple Safari | 最新版 + 1つ前 |
| Firefox | (努力目標) 最新版 |
| Internet Explorer | **非対応** |

### 5.2 デバイス・解像度

| デバイス | 解像度 | サポートレベル |
|---------|--------|---------------|
| デスクトップ | 1280px〜 | フル対応 |
| タブレット (横) | 1024px〜 | フル対応 |
| タブレット (縦) | 768px〜 | 主要機能対応 |
| モバイル | 360px〜 | 主要機能対応 (閲覧・ステータス更新中心) |

モバイルファースト設計、breakpoints は `design-requirements.md` 参照。

<!-- END SECTION 5 -->

## 6. アクセシビリティ要件

| 項目 | 基準 |
|------|------|
| WCAG準拠レベル | **AA (2.1)** |
| Lighthouse Accessibility スコア | **100** |
| コントラスト比 (本文) | 4.5:1 以上 |
| コントラスト比 (大文字) | 3.0:1 以上 |
| キーボード操作 | 全機能をキーボードのみで操作可能 |
| スクリーンリーダー | NVDA / VoiceOver / JAWS で読み上げ可能 |
| ARIA属性 | landmark / aria-label / aria-live 適切に付与 |
| タッチターゲット | 44px × 44px 以上 |
| 動画・アニメーション | `prefers-reduced-motion` 対応 |

<!-- END SECTION 6 -->

## 7. 運用・保守要件

### 7.1 ログ・監査

| 項目 | 基準 |
|------|------|
| アプリログ保存期間 | 90日 (CloudWatch Logs) |
| アクセスログ | ALB アクセスログを S3 に1年保管 |
| 監査ログ (操作履歴) | DB AuditLog テーブルに3年保管 |
| ログレベル | DEBUG / INFO / WARN / ERROR / FATAL (本番は INFO 以上) |
| センシティブデータマスキング | メールアドレス・APIキー等は自動マスク |

### 7.2 マスタ更新

| 項目 | 基準 |
|------|------|
| ガイドラインマスタ更新頻度 | **四半期毎** (法務・コンプラ担当によるレビュー) |
| 更新プロセス | (1) 改訂モニタリング → (2) ControlItem差分作成 → (3) ステージング検証 → (4) 本番反映 |
| バージョン互換 | 既存Assessmentは生成時のガイドラインバージョンを保持 |
| ユーザー通知 | 適用ガイドラインの更新時、画面上部にバナー通知 |

### 7.3 デプロイ

| 項目 | 基準 |
|------|------|
| デプロイ方式 | AWS CodePipeline + ECS Blue/Green |
| 開発環境 | `security-checklist-tool-dev.aidreams-factory.com` (自動デプロイ) |
| 本番環境 | `security-checklist-tool.aidreams-factory.com` (承認付きデプロイ) |
| ロールバック | 1コマンドで前バージョン即時復帰 (10分以内) |

### 7.4 サポート

- 問い合わせ窓口: メールフォーム + Slack (社内向け)
- AI回答へのフィードバック (Good/Bad) を収集 → 月次でプロンプト改善

<!-- END SECTION 7 -->

## 8. コンプライアンス要件

| 項目 | 基準 |
|------|------|
| 個人情報保護法 | 取扱方針をプライバシーポリシーに明記 |
| GDPR | (海外展開時) DPA契約・データポータビリティ対応 |
| 個人情報の越境移転 | LLM API がOpenAI米国の場合、利用同意取得 |
| 免責事項 | 「本ツールは補助ツールであり、法令適合性・認証取得の最終判断を代替しない」を明記 |
| データ削除 | ユーザー要請時、関連データを30日以内に削除 |

<!-- END SECTION 8 -->

## 9. 性能ベンチマーク (Lighthouse)

| 項目 | 目標値 |
|------|--------|
| Performance | **90+** |
| Accessibility | **100** |
| Best Practices | **100** |
| SEO | **100** |

<!-- END SECTION 9 -->

## 10. リスク・対策一覧 (PRD §18)

| リスク | 対策 | 担当 |
|--------|------|------|
| 推定誤り (業種誤認) | ユーザー手動修正機能、信頼度表示 | 開発 |
| 過度な自動化 (思考停止) | AIによる証跡例示、対応実態を問うプロンプト | プロンプト設計 |
| ガイドライン改版追随遅延 | 四半期マスタ更新プロセス | 法務・コンプラ |
| 法的誤認 | 免責事項UI明記 | プロダクト |
| AIハルシネーション | 公的文書ソース誘導、断定回避プロンプト、Good/Bad評価収集 | プロンプト設計 |
| データ取扱い (機密漏洩) | UI警告、AES-256暗号化、LLMへの非送信 | セキュリティ |
| LLM API障害 | キュー + リトライ、フォールバック (キャッシュ済み回答) | 開発 |
| URL クローリング失敗 | タイムアウト10秒、エラー時の手動入力フォールバック | 開発 |

<!-- END SECTION 10 -->

## 11. 関連ドキュメント

- [機能要件 (`requirements.md`)](./requirements.md)
- [デザイン要件 (`design-requirements.md`)](./design-requirements.md)
- Epic Issue: https://github.com/tsunoda-star/20260430/issues/2

<!-- END SECTION 11 -->

---

*CCAGI SDK Phase 1 — Non-Functional Requirements (REQ-NF-20260428)*
