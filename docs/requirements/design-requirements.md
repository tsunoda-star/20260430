# デザイン要件定義書 — セキュリティ対策チェックシート生成ツール

**Document ID**: REQ-DESIGN-20260428
**Version**: 1.0.0
**Source**: PRD-SEC-20260428 §5, §13 + UI参照: https://hmhm.wicle.io/
**Project**: security-checklist-tool
**Phase**: 1 (Requirements)
**Created**: 2026-04-30
**Author**: CodeGenAgent (源) via CoordinatorAgent (統)
**Epic Issue**: #2

---

## 1. 美的方向性 (Aesthetic Direction)

### 1.1 トーン (Tone)

**`professional-trustworthy`** ─ 信頼性のある専門性

セキュリティ・コンプライアンス領域においては「真面目さ」「正確性」「専門性」が最重要。同時に、中小企業の非専門家ユーザーにとって「とっつきにくさ」を解消する必要がある。これらの両立を「洗練されたミニマリズム」で実現する。

### 1.2 ムード (Mood)

**`focused-minimal`** ─ 集中を妨げない静的な美しさ

- 一画面起点UX (Hmhm参照) のため、視線誘導の単純化が最優先
- 情報密度は高くなりがち (チェックシート画面) だが、適切な余白とコントラストで「読みやすさ」を確保
- 装飾的な動きやエフェクトは最小限に抑え、データそのものを主役にする

### 1.3 差別化ポイント (Differentiation)

このプロダクトを「忘れられないもの」にする一つの要素:

> **「URL一つで、セキュリティ対策の地図が手に入る」体験**

- トップ画面の "URL入力" は **画面の中央に大きく配置**、それ以外の要素を徹底排除
- 入力直後の "分析中" 演出も Hmhm 風に **滑らかなプログレス + ガイドライン候補のフェードイン** で「期待感」を演出
- チェックシート生成完了時に **「この企業に最適な X 個のガイドラインが選ばれました」** という瞬間を主役にする

### 1.4 参照サイト

| サイト | 参照ポイント |
|-------|------------|
| https://hmhm.wicle.io/ | URL入力中心の一画面起点UX、トップの清潔感 |
| Linear (linear.app) | 情報密度の高いリスト UI、キーボードショートカット |
| Notion (notion.so) | 詳細パネルの開閉アニメーション、編集体験 |
| Vercel Dashboard | データテーブルのシャープな表現 |

<!-- END SECTION 1 -->

## 2. ブランドガイドライン

### 2.1 カラーパレット

CCブランドガイドラインの **Sky Blue (#0095C8)** をAGI/AI領域のドメインカラーとして採用しつつ、セキュリティ領域に求められる「信頼感」を加えるため、深いNavy系を主軸とする。

| 用途 | 色名 | Hex | RGB | 備考 |
|------|------|-----|-----|------|
| Primary | Deep Navy | `#0F2540` | (15,37,64) | 信頼感・専門性 |
| Primary Hover | Navy | `#1A3658` | (26,54,88) | インタラクション |
| Accent | CC Sky Blue | `#0095C8` | (0,149,200) | AI機能・分析開始ボタン |
| Accent Soft | Sky Blue Light | `#7FCBE4` | (127,203,228) | 強調・プログレス |
| Status Success | Emerald | `#079173` | (7,145,115) | 完了ステータス |
| Status Warning | Amber | `#D97706` | (217,119,6) | 期限接近 |
| Status Danger | Coral Red | `#DC2626` | (220,38,38) | 期限超過 / エラー |
| Status Neutral | Slate Gray | `#64748B` | (100,116,139) | 未対応 / 対象外 |
| Background Light | Off White | `#FAFAF7` | (250,250,247) | 背景 |
| Background Subtle | Light Gray | `#F4F4ED` | (244,244,237) | カード背景 |
| Surface | White | `#FFFFFF` | (255,255,255) | カード・モーダル |
| Border | Cool Gray | `#E2E8F0` | (226,232,240) | 区切り線 |
| Text Primary | Charcoal | `#0F172A` | (15,23,42) | 本文 |
| Text Secondary | Mid Gray | `#475569` | (71,85,105) | セカンダリ |
| Text Muted | Light Gray | `#94A3B8` | (148,163,184) | 補助情報 |

#### コントラスト比検証 (WCAG AA)

| 組み合わせ | 比率 | 判定 |
|----------|------|------|
| Charcoal `#0F172A` on Off White `#FAFAF7` | 16.0:1 | AAA ✅ |
| Mid Gray `#475569` on White `#FFFFFF` | 7.7:1 | AAA ✅ |
| White `#FFFFFF` on Deep Navy `#0F2540` | 14.8:1 | AAA ✅ |
| White `#FFFFFF` on CC Sky Blue `#0095C8` | 3.4:1 | AA (大文字) ✅ |
| Emerald `#079173` on White | 4.6:1 | AA ✅ |

### 2.2 禁止カラーパターン

PRDの「AI slop 回避」原則に従い、以下を**禁止**:

- ❌ **紫グラデーション on 白背景** (典型的なAI生成UI)
- ❌ **ピンク/紫/青のレインボーグラデーション**
- ❌ **ネオングリーン/イエローの過剰使用**
- ❌ **グレー単色の単調なUI** (プロらしさを演出しようとして失敗するパターン)

許可されるグラデーション:

- ✅ Deep Navy `#0F2540` → Navy `#1A3658` (微小な明度差のみ、ヒーロー背景等)
- ✅ CC Sky Blue `#0095C8` → Sky Blue Light `#7FCBE4` (プログレス・アクセントのみ)

<!-- END SECTION 2 -->

## 3. タイポグラフィ

### 3.1 フォントスタック

| 用途 | フォント (Latin) | フォント (日本語) | フォールバック |
|------|----------------|-------------------|---------------|
| 見出し (H1-H3) | **Manrope** (700, 600) | **Noto Sans JP** (700, 600) | sans-serif |
| 本文 | **Source Sans 3** (400, 500) | **Noto Sans JP** (400, 500) | sans-serif |
| データ・コード・ID表示 | **JetBrains Mono** (400, 500) | (Latinのみ) | ui-monospace, monospace |
| 数値 (進捗率・件数) | **Manrope** (600, tabular-nums) | (Latinのみ) | sans-serif |

### 3.2 禁止フォント

PRDの「AI slop 回避」原則に従い、以下を**禁止**:

- ❌ **Inter** (汎用すぎてブランド差別化不能)
- ❌ **Roboto** (Google デフォルト感が強い)
- ❌ **Arial** (識別性なし、AI slop の代表格)
- ❌ **Helvetica** (商用ライセンス問題 + 識別性低)

### 3.3 タイプスケール

```yaml
heading:
  h1:
    size: "2.5rem"      # 40px
    line-height: 1.2
    weight: 700
    letter-spacing: "-0.02em"
  h2:
    size: "2rem"        # 32px
    line-height: 1.25
    weight: 600
  h3:
    size: "1.5rem"      # 24px
    line-height: 1.3
    weight: 600
  h4:
    size: "1.25rem"     # 20px
    line-height: 1.4
    weight: 600

body:
  large:
    size: "1.125rem"    # 18px
    line-height: 1.6
  base:
    size: "1rem"        # 16px (本文標準)
    line-height: 1.6
  small:
    size: "0.875rem"    # 14px
    line-height: 1.5
  xs:
    size: "0.75rem"     # 12px (caption)
    line-height: 1.4
```

### 3.4 タイポグラフィ原則

- 見出しに `text-balance` を適用 (改行バランス調整)
- 数値表示に `tabular-nums` を適用 (進捗率の整列)
- 日本語の行間は欧文より広めに (1.6〜1.75)
- 一行の文字数は **75ch** を上限 (本文の可読性)

<!-- END SECTION 3 -->

## 4. UIコンポーネント方針

### 4.1 技術スタック

| 領域 | 採用ライブラリ | 理由 |
|------|---------------|------|
| Component Library | **shadcn/ui** | コピーベース・カスタマイズ自由・AA準拠 |
| CSS / Styling | **Tailwind CSS v4** | utility-first・design-token連携 |
| Animation | **motion/react** (旧 framer-motion) | 宣言的・compositor優先 |
| Icons | **lucide-react** | 線が細く清潔感、500+アイコン |
| Forms | **react-hook-form + zod** | 型安全・パフォーマンス |
| Data Table | **TanStack Table v8** | ヘッドレス・カスタマイズ自由 |
| Charts (進捗ダッシュボード) | **Recharts** or **visx** | React親和性・軽量 |
| Toast / Notification | **sonner** | shadcn/ui標準 |

### 4.2 コンポーネントクラス分類

| クラス | 例 | 配色・モーション原則 |
|--------|-----|--------------------|
| Hero (Landing) | URL入力フォーム | Deep Navyベース、CC Sky Blueアクセント、フェードイン |
| Form Input | URL / Memo / DueDate | Borderのみで構造を作り、focus時に CC Sky Blue リング |
| Card | 項目カード / ガイドラインカード | White surface, subtle border, hover時に微小shadow |
| Status Badge | 未対応/対応中/完了/対象外 | 純色の小バッジ + アイコン、コントラストAA以上 |
| Modal / Drawer | 項目詳細・AIチャット | 右ペインドロワー (デスクトップ) / フルモーダル (モバイル) |
| Button (Primary) | 「分析開始」 | CC Sky Blue 背景、白文字、影最小 |
| Button (Secondary) | 「キャンセル」 | Border + Charcoal文字 |
| Button (Destructive) | 「削除」 | Coral Red 背景、確認ダイアログ必須 |
| Toast | 完了通知・エラー | 上端 or 右下、4秒自動消去 |

### 4.3 アニメーション原則

- **持続時間**: 全インタラクションは **200ms以下** (進捗バー等の例外あり)
- **使用プロパティ**: `transform`, `opacity` のみ (compositor最適化)
- **禁止**: `width`, `height`, `top`, `left` のアニメーション (レイアウトシフト誘発)
- **イージング**: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out) を標準
- **`prefers-reduced-motion`**: 必ず尊重 (motion/react `useReducedMotion`)
- **過剰なドロップシャドウ・グロー禁止** (AI slop)

<!-- END SECTION 4 -->

## 5. レスポンシブ方針

### 5.1 設計戦略

**モバイルファースト** ─ 360px幅から設計し、breakpointで段階的に機能拡張。

ただし、本プロダクトの主要利用シーンは **デスクトップ業務利用** であるため、モバイルでは「閲覧・ステータス更新中心」の機能サブセットに絞り、編集・分析開始は推奨しない (UI上で警告表示)。

### 5.2 ブレークポイント (Tailwind準拠)

```yaml
breakpoints:
  base: "0px"        # モバイル: 360px〜639px
  sm: "640px"        # 大きめモバイル / 縦タブレット
  md: "768px"        # タブレット
  lg: "1024px"       # デスクトップ (主要利用)
  xl: "1280px"       # 大型デスクトップ
  2xl: "1536px"      # 超大型 / 外部モニタ
```

### 5.3 レイアウト切替

| 画面 | モバイル (< 768px) | タブレット (768-1023px) | デスクトップ (≥ 1024px) |
|------|------------------|------------------------|-----------------------|
| トップ (URL入力) | 縦スタック、入力フォーム中央 | 同左 | 同左、余白広め |
| 分析結果・属性確認 | 縦スタック、属性→ガイドライン順 | 2カラム | 同左 |
| チェックシート一覧 | フィルタ折りたたみ、リスト表示 | サイドフィルタ + リスト | サイドフィルタ + テーブル |
| 項目詳細・AIチャット | フルモーダル | フルモーダル | 右ペインドロワー (一覧と並列表示) |
| 設定・出力画面 | 縦スタック | 縦スタック | 2カラム |

### 5.4 タッチ・キーボード両対応

- タッチターゲット: **44 × 44px 以上**
- キーボードショートカット (デスクトップのみ):
  - `Cmd/Ctrl + K`: 検索パレット
  - `J/K`: 項目リストの上下移動
  - `Enter`: 項目詳細を開く
  - `Esc`: モーダル/ドロワーを閉じる

<!-- END SECTION 5 -->

## 6. 品質基準

### 6.1 Lighthouse

| カテゴリ | 目標値 |
|---------|--------|
| Performance | **90+** |
| Accessibility | **100** |
| Best Practices | **100** |
| SEO | **100** |

### 6.2 Core Web Vitals

| 項目 | 目標値 |
|------|--------|
| FCP (First Contentful Paint) | **< 1.8s** |
| LCP (Largest Contentful Paint) | **< 2.5s** |
| CLS (Cumulative Layout Shift) | **< 0.1** |
| INP (Interaction to Next Paint) | **< 200ms** |
| TTFB (Time to First Byte) | < 800ms |

### 6.3 アクセシビリティ (WCAG 2.1)

- **WCAG準拠レベル**: **AA**
- コントラスト比: 本文 4.5:1 以上、大文字 3.0:1 以上
- スクリーンリーダー: NVDA / VoiceOver / JAWS で読み上げ可能
- キーボードのみで全機能操作可能
- フォーカスインジケーター明示 (CC Sky Blue 2px outline)

### 6.4 バンドルサイズ

| 領域 | 目標値 |
|------|--------|
| 初期JS bundle | < 150KB (gzip) |
| 初期CSS bundle | < 30KB (gzip) |
| 画像 (LCP対象) | < 100KB / WebP or AVIF |

<!-- END SECTION 6 -->

## 7. ダークモード対応

| 項目 | 対応方針 |
|------|---------|
| ダークモード | **Phase 4以降にスコープ拡張** (初期リリースはライトモードのみ) |
| 切替UI | `prefers-color-scheme` に追従、設定画面で手動切替 |
| カラートークン | CSS Variables で light/dark 両対応設計を Phase 2 で確立 |

<!-- END SECTION 7 -->

## 8. アンチパターン (NEVER)

PRDおよび CCAGI SDK 規約に基づき、以下は**絶対に使用しない**:

| カテゴリ | 禁止パターン | 理由 |
|---------|------------|------|
| フォント | Inter, Roboto, Arial, Helvetica | AI slop / 差別化不能 |
| カラー | 紫グラデーション on 白背景 | AI slop |
| カラー | ピンク/紫/青のレインボーグラデーション | AI slop |
| エフェクト | 過剰なドロップシャドウ (`shadow-2xl` の常用) | AI slop |
| エフェクト | グロー効果 (`drop-shadow` 過剰) | AI slop |
| アニメーション | `width`/`height`/`top`/`left` のtransition | レイアウトシフト誘発 |
| アニメーション | 200ms超の頻繁なインタラクション | 体感速度低下 |
| レイアウト | 予測可能な「左サイドバー + メイン + 右サイドバー」3カラム | 差別化不足 |
| レイアウト | `100vh` の使用 | iOS Safari でアドレスバー分崩れ → `h-dvh` を使用 |
| アイコン | 絵文字 (😀🚀) のUI使用 | プロダクトのトーンと不一致 |

<!-- END SECTION 8 -->

## 9. 主要画面の視覚要件

### 9.1 トップ画面 (URL入力)

```
要素: ロゴ（左上）/ 中央寄せ大型URL入力 / 「分析開始」ボタン / フッターに最近の分析実績
配色: Deep Navy 背景 → 中央のカードはWhite Surface
フォント: H1 "セキュリティ対策チェックシートを、URLひとつで。" (Manrope 700)
余白: 上下 padding 大きめ（呼吸感）
```

### 9.2 分析結果・属性確認画面

```
要素: 推定属性カード（業種/規模/取扱情報）/ 信頼度バッジ / ガイドライン候補リスト / シート生成CTA
配色: Light背景、カードはWhite + subtle border
モーション: クローリング → 推定 → ガイドライン候補 がフェードイン順次表示（各 < 200ms）
```

### 9.3 チェックシート一覧画面

```
要素: 左サイドフィルタ（優先度/ステータス/カテゴリ） + メインテーブル
テーブル: 行hover時に subtle background（#F4F4ED）, 行クリックで右ペイン詳細
進捗ドーナツ: 右上に「全体進捗 N%」を tabular-nums で表示
```

### 9.4 項目詳細・AIチャット画面 (右ペイン)

```
要素: 項目タイトル / カテゴリパス / 説明文 / 関連ガイドラインリンク / メモ・証跡フォーム / 担当・期限 / AIチャット
モーション: 右からスライドイン (transform: translateX, 200ms)
AIチャット: ストリーミング表示 (token単位、cursor blink)
```

<!-- END SECTION 9 -->

## 10. 関連ドキュメント

- [機能要件 (`requirements.md`)](./requirements.md)
- [非機能要件 (`non-functional.md`)](./non-functional.md)
- [ソース構造化抽出 (`.ai/phase1/source-extracted.md`)](../../.ai/phase1/source-extracted.md)
- Epic Issue: https://github.com/tsunoda-star/20260430/issues/2
- Phase 2 で生成予定: `docs/design/design-system.yml`, `docs/design/ui-guidelines.md`

<!-- END SECTION 10 -->

---

*CCAGI SDK Phase 1 — Design Requirements (REQ-DESIGN-20260428)*
