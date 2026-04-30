import { describe, it, expect } from 'vitest';
import { sanitizeAiChatMarkdown } from '../markdown-sanitize';

describe('sanitizeAiChatMarkdown', () => {
  it('escapes raw HTML tags but keeps text', () => {
    const r = sanitizeAiChatMarkdown('Use <script>alert(1)</script> carefully');
    expect(r.text).not.toContain('<script>');
    expect(r.text).toContain('&lt;script&gt;');
    expect(r.text).toContain('&lt;/script&gt;');
    expect(r.notes.some((n) => n.includes('script'))).toBe(true);
  });

  it('strips on* event handlers', () => {
    const r = sanitizeAiChatMarkdown('<img src=x onerror="alert(1)" />');
    expect(r.text).not.toContain('onerror');
    expect(r.notes.some((n) => n.includes('on*'))).toBe(true);
  });

  it('replaces dangerous link targets with "#"', () => {
    const cases = [
      '[click](javascript:alert(1))',
      '[click](JaVaScRiPt:alert(1))',
      '[click](data:text/html,<script>1</script>)',
      '[click](vbscript:msgbox)',
    ];
    for (const c of cases) {
      const r = sanitizeAiChatMarkdown(c);
      expect(r.text).toContain('[click](#)');
    }
  });

  it('keeps safe markdown links untouched', () => {
    const text = '[IPA](https://www.ipa.go.jp/security/sme/index.html)';
    const r = sanitizeAiChatMarkdown(text);
    expect(r.text).toBe(text);
    expect(r.notes).toEqual([]);
  });

  it('keeps markdown structure (headings/lists/code fences)', () => {
    const text = `# 見出し
- a
- b

\`\`\`bash
echo hello
\`\`\``;
    const r = sanitizeAiChatMarkdown(text);
    expect(r.text).toBe(text);
    expect(r.notes).toEqual([]);
  });

  it('keeps blockquote markdown ">" lines', () => {
    const r = sanitizeAiChatMarkdown('> note\n> reference');
    expect(r.text).toContain('> note');
    expect(r.text).toContain('> reference');
  });

  it('returns empty notes for clean inputs', () => {
    const r = sanitizeAiChatMarkdown('AWS では IAM ポリシーで最小権限を設定します。');
    expect(r.notes).toEqual([]);
  });
});
