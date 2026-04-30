/**
 * spec.md §8.6 ai_chat 出力 Markdown XSS サニタイズ.
 *
 * AI 回答は LLM が直接生成するため、HTML 注入や悪性 URL の混入を
 * 想定して必ずサニタイズする。本ファイルは外部依存を持たない最小実装で、
 *
 *   - 生 HTML タグ (<script> 等) → エスケープ (<script>)
 *   - javascript: / data: / vbscript: スキーマの URL → "#" に置換
 *   - on*= イベントハンドラ属性除去
 *   - Markdown 構文 (見出し / リスト / リンク / コードフェンス) はそのまま保持
 *
 * 出力結果はクライアントで Markdown レンダラに渡す想定。
 * 万一 HTML として描画されても <script> はエスケープ済みなので XSS 不発。
 */

const DANGEROUS_PROTOCOL = /^\s*(?:javascript|data|vbscript):/i;

export interface SanitizeResult {
  text: string;
  /** 何が修正されたか (監査ログ用) */
  notes: string[];
}

export function sanitizeAiChatMarkdown(input: string): SanitizeResult {
  const notes: string[] = [];
  let out = input;

  // 1) Strip on* event handler attributes (e.g. onclick="...")
  if (/\son[a-z]+\s*=/i.test(out)) {
    out = out.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    notes.push('removed on* handler attribute');
  }

  // 2) Replace dangerous Markdown link/image targets ([text](javascript:...))
  out = out.replace(/(\[[^\]]*\]\()([^)]+)(\))/g, (full, open, target, close) => {
    if (DANGEROUS_PROTOCOL.test(target)) {
      notes.push(`replaced dangerous link target: ${String(target).slice(0, 30)}`);
      return `${open as string}#${close as string}`;
    }
    return full as string;
  });

  // 3) Neutralize raw HTML tags by escaping < and > on lines that look like HTML
  //    Markdown 構文 (`>` blockquote / `<>` 内 URL) は破壊しないよう、
  //    `<` 直後が英字 (タグ名) の場合のみエスケープする。
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (match, slash, name, rest) => {
    notes.push(`escaped HTML tag <${slash as string}${name as string}>`);
    return `&lt;${slash as string}${name as string}${rest as string}&gt;`;
  });

  return { text: out, notes };
}
