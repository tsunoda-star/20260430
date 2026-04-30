import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { buildCsv } from '../csv';
import { buildXlsx } from '../xlsx';
import { buildPdf, registerFonts } from '../pdf';
import { exportAssessment } from '../index';
import { safeFilename, type ExportData } from '../types';

const fixture: ExportData = {
  assessmentId: '42',
  assessmentTitle: '2026Q2 medical SaaS check',
  companyDomain: 'example.jp',
  generatedAt: '2026-04-30T10:00:00.000Z',
  rows: [
    {
      guidelineName: 'IPA SME',
      guidelineVersion: 'v1.0',
      category: 'governance',
      subCategory: 'access-control',
      controlCode: 'AC-1',
      controlTitle: 'Password policy',
      status: 'open',
      priority: 90,
      assigneeEmail: 'alice@example.com',
      dueDate: '2026-05-31',
      note: 'use 12+ chars',
      evidenceUrl: 'https://example.com/policy',
    },
    {
      guidelineName: 'MHLW Medical',
      guidelineVersion: 'v1.0',
      category: 'data-protection',
      subCategory: null,
      controlCode: null,
      controlTitle: 'Encrypt PII at rest',
      status: 'done',
      priority: 95,
      assigneeEmail: null,
      dueDate: null,
      note: null,
      evidenceUrl: null,
    },
  ],
};

describe('safeFilename', () => {
  it('strips unsafe characters and applies extension', () => {
    expect(safeFilename('My Report 2026/Q2', 'csv')).toBe('My_Report_2026_Q2.csv');
    expect(safeFilename('', 'pdf')).toBe('export.pdf');
    expect(safeFilename('a'.repeat(120), 'xlsx').endsWith('.xlsx')).toBe(true);
  });
});

describe('buildCsv', () => {
  it('builds RFC4180 CSV with UTF-8 BOM and CRLF', () => {
    const a = buildCsv(fixture);
    expect(a.format).toBe('csv');
    expect(a.contentType).toContain('text/csv');
    expect(a.filename.endsWith('.csv')).toBe(true);
    const buf = a.body;
    // BOM bytes (EF BB BF) at the head
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    // Decoded text contains expected content (BOM may be stripped by decoder)
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf);
    expect(text).toContain('"Guideline"');
    expect(text).toContain('"Version"');
    expect(text).toContain('"Password policy"');
    expect(text).toContain('"alice@example.com"');
    expect(text).toContain('\r\n');
  });

  it('truncates very long cells to avoid memory blowup', () => {
    const big = 'x'.repeat(40_000);
    const a = buildCsv({
      ...fixture,
      rows: [{ ...fixture.rows[0]!, note: big }],
    });
    const text = new TextDecoder().decode(a.body);
    expect(text).toContain('truncated');
  });
});

describe('buildXlsx', () => {
  it('produces a non-empty xlsx workbook with header + rows', async () => {
    const a = await buildXlsx(fixture);
    expect(a.format).toBe('xlsx');
    expect(a.filename.endsWith('.xlsx')).toBe(true);
    expect(a.body.byteLength).toBeGreaterThan(0);

    // Round-trip via ExcelJS to verify
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(a.body.buffer.slice(a.body.byteOffset, a.body.byteOffset + a.body.byteLength) as ArrayBuffer);
    const ws = wb.getWorksheet('Assessment');
    expect(ws).toBeDefined();
    expect(ws!.getRow(1).getCell(1).value).toBe('Guideline');
    expect(ws!.getRow(2).getCell(6).value).toBe('Password policy');
    expect(ws!.getRow(3).getCell(7).value).toBe('done');
    // hidden meta sheet
    const meta = wb.getWorksheet('_meta');
    expect(meta).toBeDefined();
  });
});

describe('buildPdf', () => {
  it('produces a non-empty PDF buffer with header bytes', async () => {
    const a = await buildPdf(fixture);
    expect(a.format).toBe('pdf');
    expect(a.contentType).toBe('application/pdf');
    expect(a.body.byteLength).toBeGreaterThan(500);
    // PDF magic %PDF
    expect(new TextDecoder().decode(a.body.subarray(0, 4))).toBe('%PDF');
  });
});

describe('exportAssessment dispatcher', () => {
  it('routes by format', async () => {
    const csv = await exportAssessment('csv', fixture);
    expect(csv.format).toBe('csv');
    const xlsx = await exportAssessment('xlsx', fixture);
    expect(xlsx.format).toBe('xlsx');
    const pdf = await exportAssessment('pdf', fixture);
    expect(pdf.format).toBe('pdf');
  });
});

describe('registerFonts (PDF JP fallback)', () => {
  it('falls back to Helvetica when fontDir is empty', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sct-fonts-'));
    const doc = new PDFDocument({ autoFirstPage: false });
    const cfg = registerFonts(doc, tmp);
    expect(cfg.hasJp).toBe(false);
    expect(cfg.jpRegular).toBe('Helvetica');
    expect(cfg.jpBold).toBe('Helvetica-Bold');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('does not throw when registerFont fails (corrupt OTF)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sct-fonts-'));
    fs.writeFileSync(path.join(tmp, 'NotoSansJP-Regular.otf'), 'not-a-font');
    const doc = new PDFDocument({ autoFirstPage: false });
    expect(() => registerFonts(doc, tmp)).not.toThrow();
    const cfg = registerFonts(doc, tmp);
    // 壊れたフォント → fallback (hasJp は false 扱い になるはずだが、
    // 一部 pdfkit バージョンでは register 自体は通って後段で失敗する.
    // ここでは "throw しない" ことだけ保証する)
    expect(cfg.jpRegular === 'Helvetica' || cfg.jpRegular === 'NotoJP').toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
