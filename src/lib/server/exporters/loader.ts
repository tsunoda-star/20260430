import { prisma } from '@/lib/server/db';
import type { ExportData } from './types';

/**
 * Assessment + AssessmentItem + ControlItem + Guideline を結合し
 * ExportData (フラットな表) を組み立てる。
 *
 * tenantId スコープを必須化 (TenantScopeViolation の防御は db.ts 拡張で重ね掛け済み)。
 */

export interface LoadAssessmentExportInput {
  tenantId: bigint;
  assessmentId: bigint;
}

export async function loadAssessmentExportData(
  input: LoadAssessmentExportInput,
): Promise<ExportData | null> {
  const assessment = await prisma.assessment.findFirst({
    where: { id: input.assessmentId, tenantId: input.tenantId },
    select: {
      id: true,
      title: true,
      company: { select: { domain: true } },
      items: {
        orderBy: [{ controlItem: { priority: 'desc' } }, { id: 'asc' }],
        select: {
          status: true,
          note: true,
          dueDate: true,
          evidenceUrl: true,
          assignee: { select: { email: true } },
          controlItem: {
            select: {
              priority: true,
              category: true,
              subCategory: true,
              controlCode: true,
              title: true,
              guidelineVersion: {
                select: {
                  version: true,
                  guideline: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!assessment) return null;

  return {
    assessmentId: assessment.id.toString(),
    assessmentTitle: assessment.title,
    companyDomain: assessment.company.domain,
    generatedAt: new Date().toISOString(),
    rows: assessment.items.map((it) => ({
      guidelineName: it.controlItem.guidelineVersion.guideline.name,
      guidelineVersion: it.controlItem.guidelineVersion.version,
      category: it.controlItem.category,
      subCategory: it.controlItem.subCategory ?? null,
      controlCode: it.controlItem.controlCode ?? null,
      controlTitle: it.controlItem.title,
      status: it.status,
      priority: it.controlItem.priority,
      assigneeEmail: it.assignee?.email ?? null,
      dueDate: it.dueDate ? it.dueDate.toISOString().slice(0, 10) : null,
      note: it.note ?? null,
      evidenceUrl: it.evidenceUrl ?? null,
    })),
  };
}
