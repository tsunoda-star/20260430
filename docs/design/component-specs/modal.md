# Component Spec: Modal / Drawer (Sheet)

**Project**: security-checklist-tool / **Phase**: 2 / **Source**: design-system.yml

---

## 用途別

| 用途 | コンポーネント | breakpoint |
|------|--------------|-----------|
| 項目詳細 (S4) | `Sheet` 右ペイン | ≥ 1024px |
| 項目詳細 (S4) | `Dialog` フル | < 1024px |
| 削除確認 | `AlertDialog` | 全 |
| ガイドライン詳細 (read) | `Dialog` 中央 | 全 |
| エクスポート設定 | `Dialog` 中央 | 全 |

## Animation

- Sheet (right): `transform: translateX(100%) → 0`, opacity 0→1, 200ms ease-out
- Dialog: `transform: scale(0.96) → 1`, opacity 0→1, 150ms
- Backdrop: opacity 0 → 0.5 (`bg-black/50`)

## A11y

- focus trap (Radix 標準)
- `Esc` で close (Reduced motion でも即座)
- aria-labelledby / aria-describedby 必須
- close ボタン (lucide X) を右上、aria-label="閉じる"
- focus return: 開く前のトリガー要素にフォーカス戻す

## Mobile dialog

- `h-dvh` (100dvh) 全画面
- 上部に小さな grabber (装飾)
- swipe-down で close (iOS-like)

## Layered modals (避ける)

- Dialog 内 Dialog は禁止
- 例外: 削除 AlertDialog のみ (一時的、画面に2層まで)

## Anti-patterns

- 100vh / fixed top:0 height:100% (h-dvh を使う)
- 紫グラデ backdrop
- entry アニメーションが 200ms 超

## Test cases

- AC: Esc で close
- AC: focus trap 機能
- AC: backdrop click で close (form 編集中は確認ダイアログ)
- AC: Reduced motion で fade のみ

<!-- END SECTION 1 -->
