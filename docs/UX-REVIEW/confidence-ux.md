# LLM Confidence < 50% UX 設計

**Document ID**: UX-CONF-20260430
**Phase**: 3 (Planning)
**Source**: docs/design/spec.md §4.1, §8.2, docs/requirements/requirements.md §3.1 (US-A03/A04)
**Project**: security-checklist-tool
**Created**: 2026-04-30

---

## 1. 背景

Phase 2 spec.md §8.2 estimation プロンプトで LLM は `confidence: 0-100` を返す。confidence が低い場合 (<50%) は推定の信頼性が低く、ユーザーによる手動確認・修正が必須。

### 信頼度区分

| 区分 | confidence 範囲 | 意味 | UX 戦略 |
|------|---------------|------|---------|
| 高 | 80-100 | 公開情報から明確に推定可能 | 緑バッジ + デフォルトで進行 |
| 中 | 50-79 | 推定可能だが要確認 | 黄バッジ + 「確認してください」軽い注意 |
| **低** | **0-49** | **推定根拠が乏しい** | **赤バッジ + 手動確認誘導 + AI質問モード** |
| 取得失敗 | LLM 失敗 | クローラー成功でも LLM 不通 | ルールベース fallback (`degraded: true`) |

---

## 2. confidence < 50% 時の UI フロー

### 2.1 警告バナー (S2 上部)

```tsx
<Banner variant="danger" persistent>
  <Icon name="alert-triangle" />
  <strong>推定の信頼度が低いです (confidence: 32)</strong>
  <p>公開情報からの推定が困難でした。以下を手動で確認・修正してください。</p>
  <ul>
    <li>業種・規模が正しいか</li>
    <li>個人情報・決済情報の取扱有無</li>
  </ul>
  <Button onClick={openManualEditor}>手動で属性を編集</Button>
  <Button variant="ghost" onClick={openAiAssistant}>AIに質問する</Button>
</Banner>
```

仕様:
- 配色: Status Danger `#DC2626` border / Background Subtle bg
- dismissable: false (修正完了まで表示維持)
- 修正後 confidence を **手動確認済 (manual)** に更新 → バナー消える

### 2.2 推定結果カードの視覚的差異

| confidence | バッジ | カード border | 主CTA |
|-----------|-------|--------------|-------|
| 80-100 | 「高」緑 (Emerald `#079173`) | Border `#E2E8F0` | 「シート生成」(primary) |
| 50-79 | 「中」黄 (Amber `#D97706`) | Border `#D97706` 1px | 「シート生成」 + 「修正する」 (secondary) |
| 0-49 | 「低」赤 (Coral Red `#DC2626`) | Border `#DC2626` 2px | 「修正する」(primary) + 「シート生成」(secondary, 確認モーダル付) |

### 2.3 手動修正モード

```
┌──────────────────────────────────────────┐
│ 属性を手動で編集 (confidence: 32)         │
├──────────────────────────────────────────┤
│ 業種:    [医療情報取扱     ▼]            │
│   推定: 不明 / 候補: 医療|金融|製造|...   │
│                                            │
│ 規模:    [中堅 (100-999名) ▼]             │
│   推定: 不明                               │
│                                            │
│ 取扱情報:                                  │
│   ☑ 個人情報   ☐ 決済情報   ☐ 機密情報   │
│                                            │
│ [キャンセル]              [保存して再選定]│
└──────────────────────────────────────────┘
```

仕様:
- 候補は LLM rationale から抽出 (フィールドごとに上位3候補)
- 「保存して再選定」→ PATCH /companies/:id → guideline 候補再取得 (SSE)

### 2.4 AI質問モード切替

confidence<50 時は「AIに質問する」CTA を提示:

```
ユーザー: 「医療系SaaSと製造業のどちらに該当しますか？」
AI: 「公開情報からは医療系SaaS の特徴 (患者情報・診療情報) が
    検出できませんでした。サイトの『製品』ページをご確認ください。
    もし主要顧客が製造業の場合は『製造業』を選択することをお勧めします。

    参考: <https://example.com/products>」
```

仕様:
- 通常の項目AIチャット (S4) と同じ SSE エンドポイント
- システムプロンプトを **属性推定モード** に切替 (§spec.md §8.2 estimation)
- ユーザー入力テキストは 公開情報のみ + マスキング

---

## 3. degraded モード (LLM 完全失敗)

クローラー成功 + LLM API 失敗時:

```tsx
<Banner variant="warning">
  <Icon name="cpu-off" />
  AI推定が一時的に利用できません。<strong>ルールベース推定</strong>で代替しています。
  <Button onClick={retryEstimation}>再推定する</Button>
</Banner>
```

仕様:
- ルールベース: ドメインTLD + meta keywords + 既知パターンマッチ
- confidence は固定 50 (manual_required フラグ)
- 必ず手動確認画面 (2.3) を経由

---

## 4. ガイドライン選定への影響

confidence<50 時:
- ベースライン (IPA-SME / METI-MGMT) は **常時適用** で確実なものを担保
- 業界別ガイドラインは「推定の信頼度が低いため候補のみ表示」と明示
- 「あなたが選択することをお勧めします」CTA で能動的選択を促す

```
推奨ガイドライン:
✅ IPA 中小企業の情報セキュリティ対策ガイドライン (常時適用)
✅ 経産省 サイバーセキュリティ経営ガイドライン (常時適用)

⚠️ 推定信頼度が低いため、以下から **手動で選択** してください:
☐ 厚労省 医療情報システム安全管理ガイドライン
☐ 経産省 工場システム CPSF
☐ NIST CSF 2.0
☐ ISO/IEC 27001
[全選択] [選択しない]
```

---

## 5. ハルシネーション防止 (US-AI04)

confidence<50 時、AI チャット (S4) の応答に追加保護:

| 保護 | 内容 |
|------|------|
| Source citation | 必ず「参考: <公的文書URL>」で締める |
| 不確実性明示 | 「公開情報からは判断困難ですが」「一般的には」など曖昧表現を許可 |
| 法令適合性免責 | 「本回答は補助情報であり、法令適合性を保証しません」フッター追加 |
| 質問例提示 | confidence<50 時は「業種を確認するには」「サイト構造から判断するには」など質問テンプレートを 3つ提示 |

---

## 6. アクセシビリティ要件

| 項目 | 要件 |
|------|------|
| 信頼度バッジ | aria-label="信頼度: 低 (32%)" |
| 警告バナー | role="alert" / aria-live="polite" |
| カラー区別 | 色だけでなく アイコン (alert-triangle / check / info) も併用 |
| 手動編集モード | キーボード操作: Tab → Esc 閉じる / Cmd+S 保存 |
| screen reader | 「確認が必要です」を最初に読み上げ |

---

## 7. テスト観点 (Phase 5 引き継ぎ)

| 観点 | テスト種 |
|------|---------|
| confidence=32 → 赤バッジ + 警告バナー表示 | GUI |
| 手動修正後 confidence='manual' → バナー消える | GUI |
| degraded mode → 「再推定する」CTA で再 API 呼出 | E2E |
| LLM フォールバック ルールベース 動作 | Integration |
| confidence<50 時のガイドライン候補が「手動選択」UI | GUI |

---

## 8. Phase 4 への提案

| 提案 | Severity | 対応 Cycle |
|-----|---------|----------|
| confidence ≥ 80 / 50-79 / <50 の3層 UI 差別化 | High | Cycle 2.3 / 2.4 |
| 警告バナー (persistent) | High | Cycle 2.3 |
| 手動修正モーダル + 「保存して再選定」 | High | Cycle 2.4 |
| AI質問モード切替 (estimation system prompt) | Medium | Cycle 2.3 / 3.1 |
| degraded mode (ルールベース fallback) | High | Cycle 2.3 |
| 質問テンプレート3つ提示 | Low | Cycle 3.1 |

<!-- END SECTION ALL -->
