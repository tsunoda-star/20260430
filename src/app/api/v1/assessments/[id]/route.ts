import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { prisma } from '@/lib/server/db';

/**
 * GET /api/v1/assessments/:id
 * Assessment 1 件の詳細 (header + items[]) を返す。
 *
 * 認可: assessment.read (全ロール)
 * tenantId スコープ + 表示用に joins (controlItem + guideline)。
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'assessment.read');
  if (!guard.ok) return guard.response;

  const id = parseId(ctx.params.id);
  if (id === null) return problemResponse('not_found');

  const { tenantId } = await resolveTenantContext(guard.user);

  const a = await prisma.assessment.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      baselineApplied: true,
      createdAt: true,
      company: { select: { id: true, domain: true, displayName: true, industry: true } },
      items: {
        orderBy: [{ controlItem: { priority: 'desc' } }, { id: 'asc' }],
        select: {
          id: true,
          status: true,
          note: true,
          assigneeId: true,
          dueDate: true,
          evidenceUrl: true,
          controlItem: {
            select: {
              id: true,
              title: true,
              category: true,
              priority: true,
              description: true,
              guidelineVersion: {
                select: {
                  version: true,
                  guideline: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!a) return problemResponse('not_found');

  return NextResponse.json({
    id: a.id.toString(),
    title: a.title,
    status: a.status,
    baselineApplied: a.baselineApplied,
    createdAt: a.createdAt.toISOString(),
    company: a.company
      ? {
          id: a.company.id.toString(),
          domain: a.company.domain,
          displayName: a.company.displayName,
          industry: a.company.industry,
        }
      : null,
    items: a.items.map((it) => ({
      id: it.id.toString(),
      status: it.status,
      note: it.note,
      assigneeId: it.assigneeId?.toString() ?? null,
      dueDate: it.dueDate?.toISOString().slice(0, 10) ?? null,
      evidenceUrl: it.evidenceUrl,
      controlItem: {
        id: it.controlItem.id.toString(),
        title: it.controlItem.title,
        category: it.controlItem.category,
        priority: it.controlItem.priority,
        description: it.controlItem.description,
        guidelineCode: it.controlItem.guidelineVersion.guideline.code,
        guidelineName: it.controlItem.guidelineVersion.guideline.name,
        guidelineVersion: it.controlItem.guidelineVersion.version,
      },
    })),
  });
}
