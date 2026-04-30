# Monitoring Runbook

**Phase 6 / Cycle 6.4** — メトリクス / ログ / アラート閾値.
spec.md §9.3 / §9.7 を SSOT とする。

---

## 1. メトリクス (CloudWatch)

| メトリクス | 警告 | クリティカル | 通知 |
|-----------|------|-----------|------|
| API p95 latency | > 1s (5min) | > 3s | Slack / PagerDuty |
| API 5xx rate | > 1% | > 5% | Slack / PagerDuty |
| Crawler block ratio | > 20% (per tenant) | > 50% | Slack |
| LLM error rate | > 5% | > 20% | Slack / Sentry |
| DB CPU | > 70% | > 90% | CloudWatch Alarm |
| DB connections | > 70% of max | > 90% | 同上 |
| ECS task unhealthy | 1 | 2+ | CloudWatch Alarm |
| Export DLQ depth | > 10 | > 50 | Slack |

通知ルート:
- 警告 → Slack `#alerts`
- クリティカル → PagerDuty (P1: 即時)

---

## 2. 構造化ログ (spec.md §9.3)

| ログレベル | 本番 | 内容 |
|----------|:---:|------|
| FATAL | ✓ | プロセス終了レベル |
| ERROR | ✓ | 5xx / 例外 |
| WARN | ✓ | 4xx 異常 / degraded |
| INFO | ✓ | リクエスト / 主要操作 |
| DEBUG | × | 開発用 (本番は無効) |

すべてのログに `traceId` (W3C traceparent) を付与し、Sentry ↔ CloudWatch ↔ DB スロークエリで横串検索可能にする。

センシティブフィールド (note / evidenceUrl / API key 等) は構造化ログ前にマスキング (`maskSensitive`).

---

## 3. ヘルスチェック

| エンドポイント | 想定実装 | チェック対象 |
|---------------|---------|------------|
| `GET /api/v1/health` | Phase 7 で追加 | DB / OpenAI / 自身の起動状態 |

**現状**: `GET /api/v1/me` が認証必須なため、ALB ヘルスチェック用には別途 `/api/v1/health` を Phase 7 で追加する想定。

---

## 4. サーキットブレーカー (LLM)

`opossum` 等で:
- 直近 60s で 50% エラー → **open** (10s)
- → **half-open** (試行)
- → 成功で **close**

**open 中**:
- estimation: ルールベース fallback (degraded=true)
- ai_chat: 固定メッセージ + 参考リンク

詳細: [spec.md §9.5](../design/spec.md#95-サーキットブレーカー)

---

## 5. 観測ダッシュボード (推奨)

### 5.1 業務メトリクス

| メトリクス | 出典 | 用途 |
|-----------|------|------|
| Companies upsert rate | audit_logs `action='company.upsert'` | ユーザー利用度 |
| Assessment 生成数 | audit_logs `action='assessment.create'` | 主要 KPI |
| AI チャット利用数 | audit_logs `action='ai_chat.create'` | LLM コスト試算 |
| AI degraded ratio | audit_logs `action='company.upsert'` afterValue.degraded | LLM 安定性 |
| Export 数 (format 別) | audit_logs `action='export.run'` | 機能利用率 |
| SSRF block 数 | audit_logs `action='ssrf.block'` | 攻撃監視 |

### 5.2 セキュリティ監視

| メトリクス | 閾値 | 対応 |
|-----------|------|------|
| 同一 IP の 401 連発 | 5/min | レート制限 (Phase 8 で実装予定) |
| 同一テナントの SSRF block | 10/5min | Slack 通知 + 一時停止検討 |
| Cognito auth fail | 50/min | DDoS 疑い → AWS WAF 強化 |
| `audit_logs.action='admin.user_update'` | 異常頻度 | テナント乗っ取り疑い |

---

## 6. ログ / メトリクスの確認コマンド

### 6.1 CloudWatch Logs Insights

```sql
-- 直近 1h で 5xx を返したリクエスト
fields @timestamp, route, status, traceId
| filter status >= 500
| stats count() by route
| sort count desc
```

### 6.2 audit_logs 集計

```sql
-- テナント別 AI チャット利用数 (直近 7d)
SELECT tenant_id, COUNT(*) AS chats
FROM audit_logs
WHERE action='ai_chat.create' AND ts > now() - interval '7 days'
GROUP BY tenant_id
ORDER BY chats DESC;
```

### 6.3 Prisma スロークエリ確認 (PostgreSQL)

```sql
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## 7. オンコール ハンドオフ (週次)

| 引き継ぎ | 内容 |
|---------|------|
| 直近 1 週間の P1 / P2 | 件数 / 主要原因 |
| RPO / RTO 目標達成度 | バックアップ実行ログ確認 |
| OpenAI コスト | 前週比 (経営層レビュー) |
| 未対応アラート | TODO / 担当者 |

---
*Phase 6 / Cycle 6.4 — Monitoring Runbook (security-checklist-tool)*
