import ExcelJS from 'exceljs';
import {
  type ExportArtifact,
  type ExportData,
  FORMAT_CONTENT_TYPES,
  safeFilename,
} from './types';

/**
 * spec.md §4.4 + Cycle 4.1: Excel (xlsx) エクスポート.
 * - 1 シート (assessment 行のフラットな表)
 * - ヘッダ行は太字、フィルタ有効化、列幅自動 (固定値)
 * - 大規模 note / evidenceUrl の cell length cap (DoS ガード)
 */

const CELL_MAX = 32_000;

function trim(v: string | null | number): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v) : v;
  if (s.length <= CELL_MAX) return s;
  return `${s.slice(0, CELL_MAX)}…(truncated)`;
}

export async function buildXlsx(data: ExportData): Promise<ExportArtifact> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'security-checklist-tool';
  wb.created = new Date(data.generatedAt);
  const ws = wb.addWorksheet('Assessment', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: 'Guideline', key: 'guidelineName', width: 28 },
    { header: 'Version', key: 'guidelineVersion', width: 10 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'SubCategory', key: 'subCategory', width: 16 },
    { header: 'ControlCode', key: 'controlCode', width: 14 },
    { header: 'ControlTitle', key: 'controlTitle', width: 36 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Priority', key: 'priority', width: 8 },
    { header: 'AssigneeEmail', key: 'assigneeEmail', width: 24 },
    { header: 'DueDate', key: 'dueDate', width: 12 },
    { header: 'Note', key: 'note', width: 40 },
    { header: 'EvidenceURL', key: 'evidenceUrl', width: 32 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  for (const r of data.rows) {
    ws.addRow({
      guidelineName: trim(r.guidelineName),
      guidelineVersion: trim(r.guidelineVersion),
      category: trim(r.category),
      subCategory: trim(r.subCategory),
      controlCode: trim(r.controlCode),
      controlTitle: trim(r.controlTitle),
      status: trim(r.status),
      priority: r.priority,
      assigneeEmail: trim(r.assigneeEmail),
      dueDate: trim(r.dueDate),
      note: trim(r.note),
      evidenceUrl: trim(r.evidenceUrl),
    });
  }

  // メタ情報を非表示シートに保存 (監査向け)
  const meta = wb.addWorksheet('_meta', { state: 'hidden' });
  meta.addRow(['assessmentId', data.assessmentId]);
  meta.addRow(['title', data.assessmentTitle]);
  meta.addRow(['companyDomain', data.companyDomain]);
  meta.addRow(['generatedAt', data.generatedAt]);

  const buffer = await wb.xlsx.writeBuffer();
  const body = new Uint8Array(buffer as ArrayBuffer);
  return {
    format: 'xlsx',
    filename: safeFilename(
      data.assessmentTitle || `assessment_${data.assessmentId}`,
      'xlsx',
    ),
    contentType: FORMAT_CONTENT_TYPES.xlsx,
    body,
  };
}
