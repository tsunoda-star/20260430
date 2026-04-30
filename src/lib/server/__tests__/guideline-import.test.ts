import { describe, it, expect } from 'vitest';
import { parseGuidelineImport } from '../guideline-import';

const VALID_JSON = JSON.stringify([
  {
    code: 'IPA-SME',
    name: '中小企業の情報セキュリティ対策ガイドライン',
    issuer: 'IPA',
    category: 'cross',
    domainTags: ['sme', 'baseline'],
    isBaseline: true,
  },
  {
    code: 'PCI-DSS-4',
    name: 'PCI DSS v4.0',
    issuer: 'PCI SSC',
    category: 'finance',
    domainTags: ['payment', 'finance'],
  },
]);

const VALID_CSV = `code,name,issuer,category,domainTags,isBaseline,sourceUrl
IPA-SME,IPA Guideline,IPA,cross,sme|baseline,true,
PCI-DSS-4,PCI DSS v4.0,PCI SSC,finance,payment|finance,false,https://example.com/pci
`;

describe('parseGuidelineImport (JSON)', () => {
  it('parses valid JSON array with default fields', () => {
    const r = parseGuidelineImport(VALID_JSON, 'application/json');
    expect(r.format).toBe('json');
    expect(r.records.length).toBe(2);
    expect(r.records[0]?.code).toBe('IPA-SME');
    expect(r.records[0]?.isBaseline).toBe(true);
    expect(r.records[1]?.isBaseline).toBe(false); // default
  });

  it('falls back to JSON when content-type missing but body starts with [', () => {
    const r = parseGuidelineImport(VALID_JSON, '');
    expect(r.format).toBe('json');
  });

  it('rejects schema violations (missing code)', () => {
    expect(() =>
      parseGuidelineImport(
        JSON.stringify([{ name: 'x', issuer: 'i', category: 'c' }]),
        'application/json',
      ),
    ).toThrow();
  });

  it('rejects empty array', () => {
    expect(() => parseGuidelineImport('[]', 'application/json')).toThrow();
  });
});

describe('parseGuidelineImport (CSV)', () => {
  it('parses valid CSV with | separator for domainTags', () => {
    const r = parseGuidelineImport(VALID_CSV, 'text/csv');
    expect(r.format).toBe('csv');
    expect(r.records.length).toBe(2);
    expect(r.records[0]?.code).toBe('IPA-SME');
    expect(r.records[0]?.domainTags).toEqual(['sme', 'baseline']);
    expect(r.records[0]?.isBaseline).toBe(true);
    expect(r.records[1]?.sourceUrl).toBe('https://example.com/pci');
    expect(r.records[1]?.isBaseline).toBe(false);
  });

  it('treats yes/1/true (case-insensitive) as isBaseline', () => {
    const csv = 'code,name,issuer,category,domainTags,isBaseline\nA,B,C,D,,YES\n';
    const r = parseGuidelineImport(csv, 'text/csv');
    expect(r.records[0]?.isBaseline).toBe(true);
  });

  it('rejects malformed CSV (missing required field)', () => {
    const csv = 'code,name\nABC,DEF\n';
    expect(() => parseGuidelineImport(csv, 'text/csv')).toThrow();
  });
});
