import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { canPerform } from '@/lib/server/permissions';
import { prisma } from '@/lib/server/db';

/**
 * PATCH /api/v1/assessment-items/:id
 * spec.md §3.2 / §6.2: ステータス / メモ / 担当 / 期限 / 証跡 を更新.
 *
 * 認可:
 *   - status / assignee / dueDate → assessment_item.update_status (editor 以上)
 *   - note / evidenceURL          → assessment_item.update_note   (reviewer も可)
 *   reviewer は note 以外を指定すると 403 forbidden を返す。
 */

export const runtime = 'nodejs';

const ItemStatusEnum = z.enum(['open', 'in_progress', 'done', 'not_applicable']);

const RequestSchema = z
  .object({
    status: ItemStatusEnum.optional(),
    note: z.string().max(8000).optional(),
    assigneeId: z.string().regex(/^\d+$/).nullable().optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD')
      .nullable()
      .optional(),
    evidenceUrl: z.string().url().max(2048).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });

function parseId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  // 操作権限の判定は変更フィールドに依存するため、最低限の認可 (note追記)
  // を先に確認する。reviewer 以上が note 系を更新できる。
  const baseGuard = await requireActionFromRequest(req, 'assessment_item.update_note');
  if (!baseGuard.ok) return baseGuard.response;

  const id = parseId(ctx.params.id);
  if (id === null) return problemResponse('not_found');

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  // status / assigneeId / dueDate を含む場合は editor 以上を要求
  const needsEditorPerm =
    parsed.data.status !== undefined ||
    parsed.data.assigneeId !== undefined ||
    parsed.data.dueDate !== undefined;
  if (needsEditorPerm && !canPerform(baseGuard.user.role, 'assessment_item.update_status')) {
    return problemResponse('forbidden', {
      detail: 'reviewer は note / evidenceUrl のみ更新可',
      extras: { role: baseGuard.user.role },
    });
  }

  const { tenantId, userId } = await resolveTenantContext(baseGuard.user);

  const existing = await prisma.assessmentItem.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      status: true,
      note: true,
      assigneeId: true,
      dueDate: true,
      evidenceUrl: true,
    },
  });
  if (!existing) return problemResponse('not_found');

  const updateData: {
    status?: 'open' | 'in_progress' | 'done' | 'not_applicable';
    note?: string;
    assigneeId?: bigint | null;
    dueDate?: Date | null;
    evidenceUrl?: string | null;
    updatedById: bigint;
  } = { updatedById: userId };
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.note !== undefined) updateData.note = parsed.data.note;
  if (parsed.data.assigneeId !== undefined) {
    updateData.assigneeId =
      parsed.data.assigneeId === null ? null : BigInt(parsed.data.assigneeId);
  }
  if (parsed.data.dueDate !== undefined) {
    updateData.dueDate = parsed.data.dueDate === null ? null : new Date(parsed.data.dueDate);
  }
  if (parsed.data.evidenceUrl !== undefined) updateData.evidenceUrl = parsed.data.evidenceUrl;

  const updated = await prisma.assessmentItem.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      status: true,
      note: true,
      assigneeId: true,
      dueDate: true,
      evidenceUrl: true,
      updatedAt: true,
    },
  });

  await writeAudit({
    tenantId,
    userId,
    action: 'assessment_item.update',
    resourceType: 'assessment_item',
    resourceId: updated.id,
    beforeValue: {
      status: existing.status,
      note: existing.note,
      assigneeId: existing.assigneeId?.toString() ?? null,
      dueDate: existing.dueDate?.toISOString() ?? null,
      evidenceUrl: existing.evidenceUrl,
    },
    afterValue: {
      status: updated.status,
      note: updated.note,
      assigneeId: updated.assigneeId?.toString() ?? null,
      dueDate: updated.dueDate?.toISOString() ?? null,
      evidenceUrl: updated.evidenceUrl,
    },
  });

  return NextResponse.json({
    id: updated.id.toString(),
    status: updated.status,
    note: updated.note,
    assigneeId: updated.assigneeId?.toString() ?? null,
    dueDate: updated.dueDate?.toISOString().slice(0, 10) ?? null,
    evidenceUrl: updated.evidenceUrl,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
