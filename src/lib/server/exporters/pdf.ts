import PDFDocument from 'pdfkit';
import {
  type ExportArtifact,
  type ExportData,
  FORMAT_CONTENT_TYPES,
  safeFilename,
} from './types';

/**
 * spec.md §4.4 + Cycle 4.1: PDF エクスポート.
 *
 * - pdfkit で 1 ページに表紙 (Assessment / Company) + 制御項目リスト
 * - 大規模 note は cap (DoS ガード)
 * - 日本語フォント埋め込みは Wave 4.5 (a11y / responsive) で対応 — 本実装は ASCII 主体表示
 *   (現状 controlTitle 等の漢字は内蔵 Helvetica で代用文字に置換される可能性あり)
 *   完全な日本語表示は後続 Cycle で対応予定。
 */

const CELL_MAX = 4_000;

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

  // ヘッダ
  doc.fontSize(18).text('Security Checklist Report', { align: 'left' });
  doc.moveDown(0.4);
  doc
    .fontSize(11)
    .fillColor('#475569')
    .text(`Title: ${trim(data.assessmentTitle)}`, { align: 'left' });
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
    doc
      .font('Helvetica-Bold')
      .text(`${i + 1}. ${trim(r.controlTitle)}`, { continued: false });
    doc
      .font('Helvetica')
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
      doc
        .fillColor('#475569')
        .text(`Note: ${trim(r.note)}`, { width: 499 });
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
