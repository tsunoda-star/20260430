# Troubleshooting Runbook

**Phase 6 / Cycle 6.4** — エラー分類別の一次対応手順。
spec.md §9 (障害設計) を SSOT とする。

---

## 1. 障害分類 (spec.md §9.1)

| 障害 | 検知 | 動作 | 通知 |
|------|------|------|------|
| Crawler timeout (10s) | fetch AbortSignal | 502 + 「手動入力に切替」UI | Sentry warning |
| Crawler SSRF block | safeFetch 例外 | 422 url_blocked + audit_log | 5分>10件で Slack |
| LLM rate limit | 429 from provider | SQS retry (exp backoff, max 3) | 連続失敗時 Sentry |
| LLM timeout | 30s soft, 60s hard | キャッシュ済み類似回答にフォールバック (任意) | Sentry |
| DB connection lost | Prisma error | 503 + 自動 retry (3回) | CloudWatch alarm |
| Export worker fail | SQS DLQ | exports.status=failed + ユーザー再試行可 | DLQ depth alarm |
| ECS task crash | health check fail | Auto Scaling で置換 | CloudWatch alarm |
| LLM provider 全停 | 連続 5xx | フィーチャーフラグで AI Chat 無効化バナー | P1 アラート |

---

## 2. SSRF block (`422 url_blocked`)

**症状**: ユーザーが URL を入力しても `422 url_blocked` で拒否される。

**原因 (reason フィールド)**:
- `invalid_protocol` — http/https 以外
- `invalid_port` — 80/443 以外を指定
- `private_or_reserved_ip` — RFC1918 / loopback / link-local / metadata
- `internal_hostname` — `localhost` / `*.local` / `metadata.*`
- `dns_resolution_failed` — 名前解決失敗
- `redirect_loop` — 4 hop 以上のリダイレクト
- `content_type_not_allowed` — text/html 以外
- `response_too_large` — 5MB 超
- `timeout` — 10s 超

**確認手順**:
1. `audit_logs` テーブルで `action='ssrf.block'` を確認 (resource_id = URL hash)
2. CloudWatch メトリクス `crawler.blocked_count` を確認
3. 1 テナントで 5 分 > 10 件なら Slack 通知 → 攻撃の可能性も検討

**対処**:
- 正当な URL なら public DNS で再解決を促す
- 内部リソース解析が必要なら別経路 (VPN / 手動入力) を案内

---

## 3. LLM 障害 (degraded fallback)

**症状**: AI 推定の `degraded: true` / AI チャットに「AI機能が一時停止中です。手動入力で続行できます。」が表示。

**原因**:
- OPENAI_API_KEY 未設定 / 失効
- OpenAI API 5xx
- timeout (estimation 30s / ai-chat 60s)
- response_format 不正 (zod schema 違反)

**確認手順**:
1. `audit_logs` で `action='company.upsert'` の `afterValue.degraded` / `afterValue.provider` を確認
2. CloudWatch Logs で OpenAI HTTP status を grep
3. SSM の OPENAI_API_KEY 期限切れを確認

**対処**:
- 一時障害: 自動 fallback で稼働継続。ルールベース推定 + 手動修正で対応
- API key 失効: SSM 更新 → ECS タスク再デプロイ
- プロバイダ全停: Phase 8 想定の feature flag で「AI Chat 無効化バナー」表示 (本フェーズ未実装)

---

## 4. DB 接続失敗 (`503 service_unavailable`)

**症状**: Route Handler が 503 を返却 / `P1001 Can't reach database`

**確認手順**:
1. RDS の CPU / connections / storage を CloudWatch で確認
2. `pg_stat_activity` で長時間クエリを特定
3. ECS タスク数と RDS max connections の比率を確認 (デフォルト 100)

**対処**:
- 接続枯渇 → 一時的にタスク数を絞る or RDS max_connections を引き上げ
- ストレージ不足 → 自動拡張が有効か確認
- DB 落ち → Multi-AZ failover (数分で復旧) / 手動再起動最終手段

---

## 5. Cognito 認証失敗 (`401 unauthorized`)

**症状**: middleware で JWT verify が失敗 → /auth/login にリダイレクト連発。

**確認手順**:
1. SSM `/security-checklist-tool/<env>/cognito/user_pool_id` / `client_id` 一致を確認
2. JWKS endpoint (`https://cognito-idp.<region>.amazonaws.com/<pool>/.well-known/jwks.json`) が 200 を返すか
3. `iss` / `aud` クレームの食い違い (Cognito User Pool ID 変更時に発生)

**対処**:
- Cognito User Pool 復元 / SSM 値更新
- JWKS キャッシュ TTL 切れ → 自動再取得を待つ (最大 10 分)

---

## 6. Idempotency-Key 衝突 (`409 conflict`)

**症状**: 同一 Idempotency-Key で異なる payload を送信 → 衝突。

**対処**:
- クライアントは新しい UUID をキーに使う
- サーバー側 in-memory store は 24h で自動失効
- 現状 single-instance 前提。マルチインスタンス化時は Redis / DB 移行が必要 (将来)

---

## 7. Export 生成失敗 (`502 upstream_error`)

**症状**: `/api/v1/assessments/{id}/exports` で 502.

**原因候補**:
- ExcelJS / pdfkit / csv-stringify 内部エラー
- メモリ不足 (ECS task memory limit)
- Prisma 取得失敗

**対処**:
1. CloudWatch Logs で `[exporter]` のスタックトレース確認
2. 行数 ≤ 50,000 を超えていないか (CSV)
3. AssessmentItem の異常データ (note 32k 超等) を抽出

---

## 8. RPO / RTO

| 項目 | 値 |
|------|---|
| RPO (Recovery Point Objective) | 24h (RDS 自動スナップショット 1日1回 / 30d 保持) |
| RTO (Recovery Time Objective) | 4h (Multi-AZ failover で実質数分、リージョン障害は手動) |
| アーティファクト保持 | S3 バージョニング有効 / 90 日後にライフサイクル削除 |

詳細: [spec.md §9.4](../design/spec.md#94-rporto--バックアップ)

---

## 9. UI エラー文言 (spec.md §9.6 SSOT)

| 状況 | UI 表示 |
|------|--------|
| Crawler timeout | 「サイト解析に時間がかかっています。手動でプロフィールを入力しますか？」 |
| SSRF block | 「このURLは内部ネットワークを参照しているため利用できません」 |
| LLM 一時障害 | 「AI機能が一時停止中です。手動入力で続行できます。」(degraded バナー) |
| Export 失敗 | 「エクスポートの生成に失敗しました。再試行する」ボタン |
| 認可エラー | 「この操作にはより上位の権限が必要です」 + Owner/Admin 問い合わせ導線 |

---

## 10. エスカレーション

| Severity | 対応者 | SLA |
|----------|-------|-----|
| P1 (LLM 全停 / DB 落ち / 5xx > 5%) | on-call SRE → Owner / CTO | 15 分以内 ack / 4h 以内復旧 |
| P2 (1 テナント影響 / 機能不全) | on-call SRE | 30 分以内 ack |
| P3 (UI 不具合 / 警告レベル) | 業務時間内 SRE | 翌営業日 |

---
*Phase 6 / Cycle 6.4 — Troubleshooting Runbook (security-checklist-tool)*
