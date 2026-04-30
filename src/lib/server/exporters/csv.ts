import { stringify } from 'csv-stringify/sync';
import {
  type ExportArtifact,
  type ExportData,
  FORMAT_CONTENT_TYPES,
  safeFilename,
} from './types';

/**
 * spec.md §4.4 + Cycle 4.1: CSV エクスポート.
 * UTF-8 BOM 付き (Excel 対応) / RFC4180 準拠 / セル内改行・"" エスケープは csv-stringify が処理.
 */

const HEADERS = [
  'Guideline',
  'Version',
  'Category',
  'SubCategory',
  'ControlCode',
  'ControlTitle',
  'Status',
  'Priority',
  'AssigneeEmail',
  'DueDate',
  'Note',
  'EvidenceURL',
] as const;

const UTF8_BOM = '﻿';
/** セル長 cap (大規模 note によるメモリ DoS 防止) */
const CELL_MAX = 32_000;

function trim(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(value) : value;
  if (s.length <= CELL_MAX) return s;
  return `${s.slice(0, CELL_MAX)}…(truncated)`;
}

export function buildCsv(data: ExportData): ExportArtifact {
  const records = data.rows.map((r) => [
    trim(r.guidelineName),
    trim(r.guidelineVersion),
    trim(r.category),
    trim(r.subCategory),
    trim(r.controlCode),
    trim(r.controlTitle),
    trim(r.status),
    trim(r.priority),
    trim(r.assigneeEmail),
    trim(r.dueDate),
    trim(r.note),
    trim(r.evidenceUrl),
  ]);
  const csvText = stringify([HEADERS as unknown as string[], ...records], {
    quoted_string: true,
    record_delimiter: '\r\n',
  });
  const body = new TextEncoder().encode(`${UTF8_BOM}${csvText}`);
  return {
    format: 'csv',
    filename: safeFilename(data.assessmentTitle || `assessment_${data.assessmentId}`, 'csv'),
    contentType: FORMAT_CONTENT_TYPES.csv,
    body,
  };
}
