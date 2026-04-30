/**
 * spec.md / design-requirements.md / Cycle 4.5: WCAG コントラスト比計算.
 *
 * - 入力: HSL リテラル ("60 33% 97%") もしくは hex ("#0F2540") もしくは
 *   sRGB triplet [r, g, b] (0..255)
 * - 出力: 1..21 のコントラスト比 (WCAG 2.1 AA: 本文 4.5:1, 大文字 3.0:1)
 *
 * 全外部依存ゼロ. tokens.css の色比較に使う想定.
 */

export type SrgbTriplet = [number, number, number];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** "#RRGGBB" / "#RGB" → [r,g,b] (0..255) */
export function hexToRgb(hex: string): SrgbTriplet {
  const m = hex.replace(/^#/, '').trim();
  const norm = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(norm)) {
    throw new Error(`invalid hex color: ${hex}`);
  }
  const r = parseInt(norm.slice(0, 2), 16);
  const g = parseInt(norm.slice(2, 4), 16);
  const b = parseInt(norm.slice(4, 6), 16);
  return [r, g, b];
}

/** "H S% L%" (CSS variables tokens.css) → [r,g,b] (0..255) */
export function hslTripletToRgb(triplet: string): SrgbTriplet {
  const m = triplet.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) throw new Error(`invalid hsl triplet: ${triplet}`);
  const h = clamp(parseFloat(m[1]!), 0, 360);
  const s = clamp(parseFloat(m[2]!), 0, 100) / 100;
  const l = clamp(parseFloat(m[3]!), 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else[r1, g1, b1] = [c, 0, x];
  const m2 = l - c / 2;
  return [
    Math.round((r1 + m2) * 255),
    Math.round((g1 + m2) * 255),
    Math.round((b1 + m2) * 255),
  ];
}

/** WCAG relative luminance 0..1 */
export function relativeLuminance(rgb: SrgbTriplet): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG コントラスト比 1..21 */
export function contrastRatio(a: SrgbTriplet, b: SrgbTriplet): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export type WcagLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';

/**
 * 本文コントラスト基準で等級判定.
 * AAA: 7.0 / AA: 4.5 / AA-large (18pt): 3.0
 */
export function classifyContrast(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}
