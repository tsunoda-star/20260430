import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { integrationPrisma, resetTenantData } from '../setup';
import { loadAssessmentExportData } from '@/lib/server/exporters/loader';
import { exportAssessment } from '@/lib/server/exporters';

/**
 * Cycle 5.2 サンプル: Assessment 作成 → loader → exporter まで実 DB 経由で疎通させる.
 * 認可レイヤ (requireActionFromRequest) はスキップし、loader / exporter の
 * Prisma 結合のみを検証する。
 */

async function seedTenantWithAssessment() {
  const tenant = await integrationPrisma.tenant.create({
    data: { externalId: `it_${Date.now()}`, name: 'Integration Tenant' },
  });
  const user = await integrationPrisma.user.create({
    data: {
      tenantId: tenant.id,
      externalId: `u_${Date.now()}`,
      email: 'integration@example.com',
      name: 'Integration User',
      role: 'admin',
    },
  });
  const company = await integrationPrisma.company.create({
    data: {
      tenantId: tenant.id,
      domain: 'integration.example',
      displayName: 'Integration Co',
      industry: 'medical-saas',
      size: 'midsize',
      inferredData: {},
      inferenceConfidence: 80,
      userOverrides: {},
      createdById: user.id,
    },
  });
  // 任意の Guideline / Version / ControlItem を 1 件用意して結合
  const guideline = await integrationPrisma.guideline.findFirst({
    where: { isActive: true, code: 'IPA-SME' },
    include: { versions: { take: 1, orderBy: { releasedAt: 'desc' } } },
  });
  const versionId = guideline?.versions[0]?.id;
  let controlItemId: bigint | null = null;
  if (versionId) {
    const ci = await integrationPrisma.controlItem.findFirst({
      where: { guidelineVersionId: versionId },
      orderBy: { id: 'asc' },
    });
    controlItemId = ci?.id ?? null;
    if (!controlItemId) {
      // ControlItem が seed されていない環境向けに最小レコード生成
      const created = await integrationPrisma.controlItem.create({
        data: {
          guidelineVersionId: versionId,
          category: 'governance',
          subCategory: 'access-control',
          controlCode: 'AC-1',
          title: 'パスワードポリシー',
          description: '8 文字以上のパスワードポリシーを設定する。',
          priority: 90,
          appliesTo: ['medical-saas'],
          normalizedKey: 'access:password',
        },
      });
      controlItemId = created.id;
    }
  }
  const assessment = await integrationPrisma.assessment.create({
    data: {
      tenantId: tenant.id,
      companyId: company.id,
      title: 'Integration Test Assessment',
      status: 'in_progress',
      guidelineVersionSnapshot: [],
      baselineApplied: true,
      createdById: user.id,
    },
  });
  if (controlItemId) {
    await integrationPrisma.assessmentItem.create({
      data: {
        tenantId: tenant.id,
        assessmentId: assessment.id,
        controlItemId,
        status: 'open',
      },
    });
  }
  return { tenant, user, company, assessment };
}

describe('exporter integration flow', () => {
  beforeEach(async () => {
    await resetTenantData();
  });

  it('loadAssessmentExportData returns flattened rows for the assessment', async () => {
    const { tenant, assessment } = await seedTenantWithAssessment();
    const data = await loadAssessmentExportData({
      tenantId: tenant.id,
      assessmentId: assessment.id,
    });
    expect(data).not.toBeNull();
    expect(data?.assessmentTitle).toBe('Integration Test Assessment');
    expect(data?.companyDomain).toBe('integration.example');
    expect(data?.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('loadAssessmentExportData enforces tenant scope (404 equivalent)', async () => {
    const { assessment } = await seedTenantWithAssessment();
    const otherTenantId = 999_999_999n;
    const data = await loadAssessmentExportData({
      tenantId: otherTenantId,
      assessmentId: assessment.id,
    });
    expect(data).toBeNull();
  });

  it('exportAssessment(xlsx) produces a valid workbook with headers', async () => {
    const { tenant, assessment } = await seedTenantWithAssessment();
    const data = await loadAssessmentExportData({
      tenantId: tenant.id,
      assessmentId: assessment.id,
    });
    expect(data).not.toBeNull();
    const artifact = await exportAssessment('xlsx', data!);
    expect(artifact.format).toBe('xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      artifact.body.buffer.slice(
        artifact.body.byteOffset,
        artifact.body.byteOffset + artifact.body.byteLength,
      ) as ArrayBuffer,
    );
    const ws = wb.getWorksheet('Assessment');
    expect(ws).toBeDefined();
    expect(ws!.getRow(1).getCell(1).value).toBe('Guideline');
  });
});
