/**
 * spec.md §3.2 / §4.4: Assessment エクスポート用の共通データ形状.
 * 各 exporter (csv / xlsx / pdf) はこの ExportData を入力に受ける。
 * Prisma 依存なし — テスト時はフィクスチャで直接組み立てて使用。
 */

export type ExportFormat = 'xlsx' | 'pdf' | 'csv';

export interface ExportRow {
  guidelineName: string;
  guidelineVersion: string;
  category: string;
  subCategory: string | null;
  controlCode: string | null;
  controlTitle: string;
  status: string;
  priority: number;
  assigneeEmail: string | null;
  dueDate: string | null; // YYYY-MM-DD
  note: string | null;
  evidenceUrl: string | null;
}

export interface ExportData {
  assessmentId: string;
  assessmentTitle: string;
  companyDomain: string;
  generatedAt: string; // ISO
  rows: ExportRow[];
}

export interface ExportArtifact {
  format: ExportFormat;
  /** 推奨ファイル名 (Content-Disposition で渡す) */
  filename: string;
  /** Content-Type */
  contentType: string;
  /** 本体バイナリ (CSV は UTF-8 文字列を bytes 化) */
  body: Uint8Array;
}

export const FORMAT_CONTENT_TYPES: Readonly<Record<ExportFormat, string>> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8',
};

/** 安全なファイル名 (英数字・ハイフン・アンダースコア・ドットのみ) */
export function safeFilename(base: string, ext: ExportFormat): string {
  const safe = base.replace(/[^A-Za-z0-9_\-.]/g, '_').slice(0, 64) || 'export';
  return `${safe}.${ext}`;
}
