import { buildCsv } from './csv';
import { buildPdf } from './pdf';
import { buildXlsx } from './xlsx';
import type { ExportArtifact, ExportData, ExportFormat } from './types';

/**
 * format に応じて該当 exporter を呼び出すディスパッチャ.
 */
export async function exportAssessment(
  format: ExportFormat,
  data: ExportData,
): Promise<ExportArtifact> {
  switch (format) {
    case 'csv':
      return buildCsv(data);
    case 'xlsx':
      return buildXlsx(data);
    case 'pdf':
      return buildPdf(data);
    default: {
      const _exhaustive: never = format;
      throw new Error(`unsupported export format: ${_exhaustive as string}`);
    }
  }
}

export { buildCsv, buildPdf, buildXlsx };
export type { ExportArtifact, ExportData, ExportFormat, ExportRow } from './types';
