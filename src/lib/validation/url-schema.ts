import { z } from 'zod';

/**
 * URL投入フォーム用 zod スキーマ。
 *
 * 入力時バリデーション (UI レイヤ):
 *   - https のみ許可
 *   - 最大 2048 文字
 *   - host が空でない
 *
 * SSRF 対策 (private IP / loopback / 169.254 等の遮断) は
 * サーバー側 `safeFetch()` の責務 (spec.md §7 / Cycle 2.2)。
 */
export const urlSchema = z.object({
  url: z
    .string({ required_error: 'URL を入力してください' })
    .trim()
    .min(1, 'URL を入力してください')
    .max(2048, 'URL が長すぎます (2048文字以内)')
    .refine(
      (value) => {
        try {
          const u = new URL(value);
          return u.protocol === 'https:' && u.hostname.length > 0;
        } catch {
          return false;
        }
      },
      { message: 'https から始まる正しい URL を入力してください' },
    ),
});

export type UrlFormInput = z.infer<typeof urlSchema>;
