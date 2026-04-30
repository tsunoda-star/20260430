# SSE 進捗フィードバック・cancel・retry 設計

**Document ID**: UX-SSE-20260430
**Phase**: 3 (Planning)
**Source**: docs/design/spec.md §3.2, §4.1, §4.3 (SSE), docs/design/ui-guidelines.md
**Project**: security-checklist-tool
**Created**: 2026-04-30

---

## 1. SSE 利用箇所

Phase 2 spec.md で SSE が必須となる処理:

| 処理 | エンドポイント | 想定時間 | UX 戦略 |
|------|--------------|---------|--------|
| URL クロール → LLM 推定 | POST /api/v1/companies → GET /companies/:id (poll) | 5-15s | 段階的進捗 + cancel |
| AI チャット (S4) | POST /api/v1/assessment-items/:id/ai-chat | 1-30s (stream) | streaming + cancel |
| エクスポート生成 | POST /api/v1/assessments/:id/exports → GET /exports/:id (poll) | 3-60s | 進捗 + ダウンロード |

※ "POST /companies" は 202 + pollUrl パターン、AI チャットは true SSE。本ドキュメントでは両者を統合的に扱う。

---

## 2. 体感速度設計の原則

### 2.1 Doherty Threshold (400ms)

ユーザー入力後 **400ms 以内** に何らかの視覚フィードバックを返す:

```
0ms      入力 (Enter押下)
↓
50ms     ボタン → loading state (spinner)
↓
200ms    Skeleton レイアウト 表示開始 (fade-in 200ms)
↓
500ms    最初の進捗メッセージ「URL を解析中...」
↓
1500ms   クロール開始 (1段階目アニメーション)
↓
3000ms   推定中 (2段階目)
↓
5-15s    完了
```

### 2.2 Skeleton vs Streaming の使い分け

| 状況 | 戦略 | 例 |
|------|------|----|
| データ構造が予測可能 | **Skeleton** (shape を先に表示) | チェックシート一覧 (S3) |
| 内容が逐次生成される | **Streaming** (テキスト追加) | AI チャット (S4) / LLM 推定 |
| 完了時間が予測可能 (定型処理) | **Determinate Progress** (進捗バー) | エクスポート生成 |
| 完了時間が予測不能 | **Indeterminate** (脈動バー / spinner) | 外部 API 待機 |

---

## 3. URL クロール → LLM 推定の進捗 UX

### 3.1 段階的進捗表示

```
┌──────────────────────────────────────────┐
│ https://example-medical-saas.jp を解析中  │
├──────────────────────────────────────────┤
│ ✅ DNS解決 (32ms)                          │
│ ✅ HTTP 取得 (1.2s)                        │
│ ✅ テキスト抽出 (450ms)                    │
│ ⏳ AI推定中... (2/5s 経過)                 │
│ ⌛ ガイドライン選定                         │
│                                            │
│ [⊘ キャンセル]                              │
└──────────────────────────────────────────┘
```

仕様:
- 各ステップは `audit_logs` の `crawler.*` / `llm.*` イベントで判定
- ✅/⏳/⌛ は lucide-react `check-circle` / `loader-2` (spin) / `clock`
- カウンターは経過秒のみ (推定時間は最大値 "10s" として表示しない — 期待を裏切らない)
- フェードイン 200ms / compositor props (transform/opacity) のみ

### 3.2 cancel ボタン

```typescript
const abortController = new AbortController();
const cancel = () => {
  abortController.abort();
  fetch(`/api/v1/companies/${id}/cancel`, { method: 'POST' });
};
```

仕様:
- クライアント側 AbortController で fetch 中断
- サーバー側 cancel API でクロール job を中止 (SQS message delete)
- cancel 後は「処理を中止しました。再試行する [↻ 再分析]」表示
- Esc キーでも cancel 可能 (キーボードショートカット)

### 3.3 retry ボタン

失敗時 (502 upstream_error / 422 url_blocked) に表示:

| 失敗原因 | retry 戦略 | UI |
|---------|----------|-----|
| クローラー timeout (10s) | 同URL retry (3回まで, exponential backoff) | 「↻ 再試行」+ counter |
| クローラー network | 同URL retry | 同上 |
| SSRF block (422) | retry **不可** + 別URL誘導 | 「別のURLを入力」CTA |
| LLM 失敗 | ルールベース fallback (degraded) | 「ルールベース推定を継続 [OK]」 |
| LLM rate limited (429) | 30秒後 retry (タイマー表示) | 「30秒後に自動再試行」 |

---

## 4. AI チャット SSE 設計 (S4)

### 4.1 Streaming UX

```
ユーザー: 医療情報のアクセスログ要件は？
                                              [⊘]
AI: 医療情報のアクセスログ要件は、|     ← 200ms 以内に最初のトークン
    厚労省「医療情報システムの安全管理に関する|
    ガイドライン」第6.7条に定義されています。
    主要要件は以下の通りです:
    
    1. アクセス日時
    2. ユーザーID
    3. 操作対象
    ...|
                                              [⊘ 中断]
```

仕様:
- 1トークンずつ append (typewriter effect 不要 — distract する)
- カーソル `▌` は最後のトークン後にのみ表示 (CSS animation)
- フッター: `[⊘ 中断] [👍 Good] [👎 Bad]`
- 中断時は途中まで保存 + 「(中断されました)」マーカー追加

### 4.2 cancel (中断)

```typescript
const stream = new EventSource(...);
const cancel = () => {
  stream.close();
  fetch(`/api/v1/ai-chats/${chatId}/cancel`, { method: 'POST' });
};
```

仕様:
- 中断後はそれまで生成された内容を保存 (DB)
- 「再生成」ボタンで同質問を再投稿可能
- 「Good/Bad」評価は中断後でも可能

### 4.3 retry / 再生成

- 「再生成」ボタンで同 question + 同 context で再 LLM 呼出
- AI 回答は AI チャット履歴に **新ターン** として追加 (上書きしない)
- Phase 1 US-AI03 (Good/Bad 評価) との整合性: Bad 評価時に「再生成」ヒント表示

---

## 5. エクスポート進捗 UX

### 5.1 進捗モーダル

```
┌──────────────────────────────────────────┐
│ PDF を生成中...                           │
├──────────────────────────────────────────┤
│ ████████████████░░░░░░░  67%              │
│                                            │
│ ✅ チェックシート集計 (1.2s)               │
│ ⏳ PDF レンダリング (3/15s)                │
│ ⌛ S3 アップロード                          │
│                                            │
│ 平均時間: 8s        [⊘ キャンセル]         │
└──────────────────────────────────────────┘
```

仕様:
- 「平均時間」は過去30回の中央値を表示 (期待値の透明化)
- 完了時: モーダル閉 + トースト「PDF が生成されました [📥 ダウンロード]」
- ダウンロードリンクは 15分 TTL を併記「(15分有効)」

### 5.2 バックグラウンド継続

ユーザーが他画面に移動した場合:
- グローバルナビ右上に「⏳ エクスポート生成中 (67%)」mini progress
- 完了時にトースト通知

---

## 6. アニメーション仕様

| 要素 | duration | timing | property |
|------|---------|--------|---------|
| Skeleton fade-in | 200ms | ease-out | opacity, transform: translateY |
| Progress bar | 200ms | linear | transform: scaleX |
| Spinner rotation | 1000ms | linear | transform: rotate |
| Streaming token append | 0ms (no animation) | - | - |
| Toast slide-in | 200ms | ease-out | transform: translateY, opacity |
| Modal open | 200ms | ease-out | opacity, transform: scale |

**禁止**:
- ❌ レイアウトプロパティ (width / height / top / left) のアニメーション
- ❌ 200ms 超のアニメーション (S4 入力中以外)
- ❌ blur / will-change の濫用

---

## 7. アクセシビリティ要件

| 項目 | 要件 |
|------|------|
| 進捗 | role="progressbar" / aria-valuenow / aria-valuemax |
| streaming | aria-live="polite" (新トークン読み上げ過剰防止) |
| cancel | aria-label="処理を中止" / Esc ショートカット |
| retry | aria-label="再試行" / focus 自動付与 |
| screen reader | 完了時「処理が完了しました」明示通知 |

---

## 8. テスト観点 (Phase 5 引き継ぎ)

| 観点 | テスト種 |
|------|---------|
| クロール 5段階の段階的表示 | E2E |
| cancel ボタン → server も中止 (audit_log 確認) | E2E |
| 10s timeout → 「↻ 再試行」CTA 表示 | Integration |
| AI チャット streaming → 初トークン<2s | E2E (perf) |
| エクスポート バックグラウンド mini progress | E2E |
| 中断後の AI チャット履歴復元 | Integration |

---

## 9. Phase 4 への提案

| 提案 | Severity | 対応 Cycle |
|-----|---------|----------|
| クロール 5段階進捗 UI | High | Cycle 3.4 |
| AI チャット streaming + cancel | High | Cycle 3.1 / 3.4 |
| retry ボタン (失敗種別ごとに動作) | High | Cycle 3.4 |
| エクスポート mini progress (グローバル) | Medium | Cycle 4.1 |
| 平均時間メトリクス表示 (DB から取得) | Low | Cycle 4.1 (P3) |
| Esc キャンセルショートカット | Medium | Cycle 3.4 |

<!-- END SECTION ALL -->
