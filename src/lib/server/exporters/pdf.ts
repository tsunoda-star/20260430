import * as fs from 'node:fs';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';
import {
  type ExportArtifact,
  type ExportData,
  FORMAT_CONTENT_TYPES,
  safeFilename,
} from './types';

/**
 * spec.md §4.4 + Cycle 4.1 + Cycle 7.3c: PDF エクスポート.
 *
 * - pdfkit で 1 ページに表紙 (Assessment / Company) + 制御項目リスト
 * - 大規模 note は 4k 字 cap (DoS ガード)
 * - 日本語フォント (Noto Sans CJK JP SubsetOTF) を public/fonts に
 *   登録できる場合は使用、なければ Helvetica fallback
 *   セットアップ: `node scripts/download-fonts.mjs`
 */

const CELL_MAX = 4_000;

const FONT_DIR = path.resolve(process.cwd(), 'public', 'fonts');

interface FontConfig {
  /** pdfkit 内部の論理フォント名 */
  jpRegular: string;
  jpBold: string;
  /** ASCII / 数字に使うフォント */
  asciiRegular: string;
  asciiBold: string;
  /** Noto JP TTF/OTF が読み込めたか */
  hasJp: boolean;
}

/**
 * フォント候補を pdfkit doc に登録し、利用可能なフォント名集合を返す。
 * テスト容易化のため fontDir を引数で渡せる。
 */
export function registerFonts(
  doc: InstanceType<typeof PDFDocument>,
  fontDir = FONT_DIR,
): FontConfig {
  const cfg: FontConfig = {
    jpRegular: 'Helvetica',
    jpBold: 'Helvetica-Bold',
    asciiRegular: 'Helvetica',
    asciiBold: 'Helvetica-Bold',
    hasJp: false,
  };

  const reg = path.join(fontDir, 'NotoSansJP-Regular.otf');
  const bold = path.join(fontDir, 'NotoSansJP-Bold.otf');
  if (!fs.existsSync(reg)) return cfg;
  try {
    doc.registerFont('NotoJP', reg);
    cfg.jpRegular = 'NotoJP';
    if (fs.existsSync(bold)) {
      doc.registerFont('NotoJP-Bold', bold);
      cfg.jpBold = 'NotoJP-Bold';
    } else {
      // Bold が無くても Regular を太字代用 (見た目は太くないが文字化けしない)
      cfg.jpBold = 'NotoJP';
    }
    cfg.hasJp = true;
  } catch {
    // 登録失敗 (壊れた TTF/OTF) → Helvetica fallback のまま
  }
  return cfg;
}

function trim(v: string | null | number): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v) : v;
  if (s.length <= CELL_MAX) return s;
  return `${s.slice(0, CELL_MAX)}…(truncated)`;
}

export async function buildPdf(data: ExportData): Promise<ExportArtifact> {
  const buffers: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margin: 48, autoFirstPage: true });
  doc.on('data', (chunk) => buffers.push(chunk as Buffer));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));
  });

  const fonts = registerFonts(doc);

  // ヘッダ (タイトルは ASCII 維持)
  doc.font(fonts.asciiBold).fontSize(18).text('Security Checklist Report', {
    align: 'left',
  });
  doc.moveDown(0.4);
  doc.font(fonts.jpRegular).fontSize(11).fillColor('#475569');
  doc.text(`Title: ${trim(data.assessmentTitle)}`, { align: 'left' });
  doc.text(`Company: ${trim(data.companyDomain)}`);
  doc.text(`Generated: ${trim(data.generatedAt)}`);
  doc.text(`Items: ${data.rows.length}`);
  doc.moveDown(0.6);
  doc.fillColor('#0F172A');

  // 区切り
  doc
    .strokeColor('#E2E8F0')
    .lineWidth(0.7)
    .moveTo(48, doc.y)
    .lineTo(547, doc.y)
    .stroke();
  doc.moveDown(0.6);

  // 各行 (簡易リスト)
  doc.fontSize(10);
  for (let i = 0; i < data.rows.length; i++) {
    const r = data.rows[i];
    if (!r) continue;
    if (doc.y > 760) doc.addPage();
    doc.font(fonts.jpBold);
    doc.text(`${i + 1}. ${trim(r.controlTitle)}`, { continued: false });
    doc
      .font(fonts.jpRegular)
      .fillColor('#475569')
      .text(
        [
          trim(r.guidelineName),
          trim(r.guidelineVersion),
          trim(r.category),
          r.subCategory ? trim(r.subCategory) : '',
        ]
          .filter(Boolean)
          .join(' / '),
      );
    doc.fillColor('#0F172A').text(
      `Status: ${trim(r.status)}  Priority: ${r.priority}` +
        (r.dueDate ? `  Due: ${trim(r.dueDate)}` : '') +
        (r.assigneeEmail ? `  Assignee: ${trim(r.assigneeEmail)}` : ''),
    );
    if (r.note) {
      doc.fillColor('#475569').text(`Note: ${trim(r.note)}`, { width: 499 });
    }
    if (r.evidenceUrl) {
      doc.fillColor('#0095C8').text(`Evidence: ${trim(r.evidenceUrl)}`);
    }
    doc.fillColor('#0F172A').moveDown(0.4);
  }

  doc.end();
  const buffer = await finished;
  const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  return {
    format: 'pdf',
    filename: safeFilename(data.assessmentTitle || `assessment_${data.assessmentId}`, 'pdf'),
    contentType: FORMAT_CONTENT_TYPES.pdf,
    body,
  };
}
