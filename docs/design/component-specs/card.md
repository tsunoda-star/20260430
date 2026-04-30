# Component Spec: Card

**Project**: security-checklist-tool / **Phase**: 2 / **Source**: design-system.yml

---

## Anatomy

```
<Card>                          // bg-white, border #E2E8F0, radius 12px
  <CardHeader>                  // pad 24px, border-b
    <CardTitle>...</CardTitle>  // h3 / 1.5rem / Manrope 600
    <CardDescription>...        // 0.875rem / Mid Gray
  </CardHeader>
  <CardContent>...              // pad 24px
  <CardFooter>...               // pad 24px, border-t (optional)
</Card>
```

## States

- default: shadow-none
- hover (interactive): shadow-sm, transform: translateY(-1px), 150ms
- selected: ring 2px `#0095C8`

## Sub-types

| 用途 | カスタマイズ |
|------|------------|
| Profile card (S2) | h3 + 信頼度バッジ右上、編集ボタン |
| Guideline card (S2) | アイコン (lucide ShieldCheck) + 発行主体 + バージョン |
| Checklist row card (S3 mobile) | priority bar 左端 (4px縦) + status badge |
| AI chat message (S4) | margin per role, role: user / assistant |

## Anti-patterns

- shadow-2xl の常用
- 紫グラデーション背景
- card 内 card 三層以上のネスト

## Test cases

- AC: keyboard nav 可能 (interactive 時 tabindex=0)
- AC: aria-label / role="article" 適切
- AC: hover transitions 150ms以内

<!-- END SECTION 1 -->
