# Component Spec: Form

**Project**: security-checklist-tool / **Phase**: 2 / **Source**: design-system.yml

---

## Stack

- `react-hook-form` (controller pattern)
- `zod` schema → `zodResolver`
- shadcn `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`

## Field types

| 用途 | コンポーネント |
|------|--------------|
| URL入力 (S1) | `Input type="url"` + 中央寄せ大型サイズ (h-14, text-2xl) |
| Memo (S4) | `Textarea` autosize, max 4000 chars |
| 期限日 (S4) | `Calendar` + `Popover` |
| ステータス (S4) | `Select` (Open/InProgress/Done/N.A.) |
| 担当 (S4) | `Combobox` + Avatar (ユーザー検索) |
| 証跡URL (S4) | `Input type="url"` + url 検証 |

## Validation rules (zod)

```typescript
const UrlSchema = z.string().url().max(2048).refine(/* SSRF pre-check */);
const NoteSchema = z.string().max(4000);
const EvidenceUrlSchema = z.string().url().max(2048).optional();
const DueDateSchema = z.coerce.date().min(new Date()).optional();
```

## Error display

- `FormMessage` 直下に Coral Red `#DC2626` 0.875rem
- aria-describedby に紐付け
- フィールド境界線も Coral Red 化

## Submit states

- disabled: 検証エラーあり / pending
- loading: Button に Loader2 + aria-busy

## Focus order

- ラベル → 入力 → ヒント → エラーの順
- Tab で論理順移動

## Anti-patterns

- `<input>` を div で囲んでカスタムスタイル偽装 (a11y欠落)
- placeholder で label 代用
- 必須の "*" のみで required 表現 (aria-required も付与)

## Test cases

- AC: zod 検証メッセージが画面とアクセシビリティツリーで一致
- AC: keyboard で完結
- AC: error 時に `aria-invalid="true"` 付与
- AC: 連続submit防止 (debounce + idempotency-key)

<!-- END SECTION 1 -->
