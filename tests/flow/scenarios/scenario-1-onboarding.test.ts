import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { flowPrisma, resetTenantData } from '../setup';
import { aggregateDashboard } from '@/lib/server/dashboard';
import { exportAssessment } from '@/lib/server/exporters';
import { loadAssessmentExportData } from '@/lib/server/exporters/loader';

/**
 * F-01 (medical SaaS Onboarding 完全フロー).
 * spec.md §4.1 + flow-test-design.md §2 (F-01) に対応.
 *
 * Steps:
 *  1. Tenant + User (admin) を作成
 *  2. 推定済み Company を作成 (実 LLM はスキップ — 推定値直書きで構造を試す)
 *  3. Guideline (seed 既存) から ControlItem を引いて Assessment + items を作る
 *  4. AssessmentItem の status を更新 (open → done)
 *  5. ダッシュボード集計 (aggregateDashboard) で完了率 100% を確認
 *  6. CSV / XLSX / PDF 3 format を生成して非空 + magic を確認
 */

async function pickAnyControlItem(): Promise<bigint | null> {
  const ci = await flowPrisma.controlItem.findFirst({ orderBy: { id: 'asc' } });
  if (ci) return ci.id;
  // ControlItem が seed されていない環境向けに最小レコード生成
  const v = await flowPrisma.guidelineVersion.findFirst({
    orderBy: { releasedAt: 'desc' },
  });
  if (!v) return null;
  const created = await flowPrisma.controlItem.create({
    data: {
      guidelineVersionId: v.id,
      category: 'governance',
      subCategory: 'access-control',
      controlCode: 'AC-1',
      title: 'パスワードポリシー',
      description: '8 文字以上のパスワードポリシーを設定する',
      priority: 90,
      appliesTo: ['medical-saas'],
      normalizedKey: 'access:password',
    },
  });
  return created.id;
}

describe('F-01: medical SaaS onboarding flow', () => {
  beforeEach(async () => {
    await resetTenantData();
  });

  it('completes the assessment and exports it in all 3 formats', async () => {
    // Step 1: Tenant + Admin
    const tenant = await flowPrisma.tenant.create({
      data: { externalId: `flow_${Date.now()}`, name: 'Flow Tenant' },
    });
    const admin = await flowPrisma.user.create({
      data: {
        tenantId: tenant.id,
        externalId: `u_admin_${Date.now()}`,
        email: 'admin@flow.example',
        name: 'Flow Admin',
        role: 'admin',
      },
    });

    // Step 2: Company (推定値直書き)
    const company = await flowPrisma.company.create({
      data: {
        tenantId: tenant.id,
        domain: 'flow-medical.example.jp',
        displayName: 'Flow Medical SaaS',
        industry: 'medical-saas',
        size: 'midsize',
        inferredData: {
          industry: 'medical-saas',
          size: 'midsize',
          b2x: 'b2b',
          handles_personal_info: true,
          handles_payment: false,
          confidence: 80,
          rationale: '医療機関向け SaaS と推定',
        },
        inferenceConfidence: 80,
        userOverrides: {},
        createdById: admin.id,
      },
    });

    // Step 3: Assessment + AssessmentItem
    const controlItemId = await pickAnyControlItem();
    expect(controlItemId).not.toBeNull();
    const assessment = await flowPrisma.assessment.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        title: '2026Q2 medical SaaS check',
        status: 'in_progress',
        guidelineVersionSnapshot: [],
        baselineApplied: true,
        createdById: admin.id,
      },
    });
    const item = await flowPrisma.assessmentItem.create({
      data: {
        tenantId: tenant.id,
        assessmentId: assessment.id,
        controlItemId: controlItemId!,
        status: 'open',
      },
    });

    // Step 4: 完了させる
    await flowPrisma.assessmentItem.update({
      where: { id: item.id },
      data: { status: 'done', updatedById: admin.id },
    });

    // Step 5: Dashboard 集計 (Prisma 経由 + aggregator pure)
    const items = await flowPrisma.assessmentItem.findMany({
      where: { tenantId: tenant.id, assessmentId: assessment.id },
      select: {
        status: true,
        dueDate: true,
        controlItem: { select: { category: true } },
      },
    });
    const dashboard = aggregateDashboard(
      items.map((it) => ({
        status: it.status,
        dueDate: null,
        category: it.controlItem.category,
      })),
    );
    expect(dashboard.totalCount).toBe(1);
    expect(dashboard.completionRate).toBe(1); // 100%
    expect(dashboard.statusCounts.done).toBe(1);

    // Step 6: 3 format export
    const exportData = await loadAssessmentExportData({
      tenantId: tenant.id,
      assessmentId: assessment.id,
    });
    expect(exportData).not.toBeNull();

    const csv = await exportAssessment('csv', exportData!);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(csv.body);
    expect(text).toContain('"Guideline"');
    expect(text).toContain(exportData!.rows[0]!.controlTitle);

    const xlsx = await exportAssessment('xlsx', exportData!);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      xlsx.body.buffer.slice(
        xlsx.body.byteOffset,
        xlsx.body.byteOffset + xlsx.body.byteLength,
      ) as ArrayBuffer,
    );
    expect(wb.getWorksheet('Assessment')).toBeDefined();

    const pdf = await exportAssessment('pdf', exportData!);
    expect(pdf.body.byteLength).toBeGreaterThan(500);
    expect(new TextDecoder().decode(pdf.body.subarray(0, 4))).toBe('%PDF');
  });
});
