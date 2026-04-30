# Component Spec: Button

**Project**: security-checklist-tool / **Phase**: 2 / **Source**: design-system.yml

---

## Variants

| variant | bg | fg | border | hover |
|---------|----|----|--------|-------|
| primary | `#0095C8` | white | none | `#0080AE` |
| secondary | white | `#0F172A` | `#E2E8F0` 1px | `#F4F4ED` |
| destructive | `#DC2626` | white | none | `#B91C1C` (confirm dialog 必須) |
| ghost | transparent | `#475569` | none | bg `#F4F4ED` |
| link | transparent | `#0095C8` | none | underline |

## Sizes (touch target ≥ 44px)

| size | height | padding-x | font |
|------|--------|----------|------|
| sm | 36px (デスクトップのみ) | 12px | 14px |
| md (default) | 44px | 16px | 16px |
| lg | 48px | 24px | 16px |

## States

- focus: `outline 2px solid #0095C8`, offset 2px
- disabled: `opacity 0.5`, `cursor: not-allowed`, aria-disabled
- loading: spinner (lucide `Loader2` animate-spin) + aria-busy

## Anti-patterns

- `box-shadow` 過剰
- 200ms超のhover transition
- 紫グラデーション

## Test cases

- AC: hover/focus/active で色変化
- AC: keyboard `Enter` / `Space` で発火
- AC: aria-label 必須 (アイコンのみの場合)
- AC: コントラスト比 AA 以上 (各variant)

<!-- END SECTION 1 -->
