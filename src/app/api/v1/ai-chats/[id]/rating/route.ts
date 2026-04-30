import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { prisma } from '@/lib/server/db';

/**
 * POST /api/v1/ai-chats/:id/rating
 * spec.md §4.3 / §8.7: AI 回答に対する Good/Bad 評価.
 * 認可: ai_chat.rate (owner / admin / editor / reviewer)
 */

export const runtime = 'nodejs';

const RequestSchema = z.object({ rating: z.enum(['good', 'bad']) });

function parseId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'ai_chat.rate');
  if (!guard.ok) return guard.response;

  const id = parseId(ctx.params.id);
  if (id === null) return problemResponse('not_found');

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  const { tenantId, userId } = await resolveTenantContext(guard.user);

  const existing = await prisma.aiChat.findFirst({
    where: { id, tenantId },
    select: { id: true, rating: true, promptVersion: true },
  });
  if (!existing) return problemResponse('not_found');

  const updated = await prisma.aiChat.update({
    where: { id: existing.id },
    data: { rating: parsed.data.rating },
    select: { id: true, rating: true, promptVersion: true },
  });

  await writeAudit({
    tenantId,
    userId,
    action: 'ai_chat.rate',
    resourceType: 'ai_chat',
    resourceId: updated.id,
    beforeValue: { rating: existing.rating },
    afterValue: { rating: updated.rating, promptVersion: updated.promptVersion },
  });

  return NextResponse.json({
    id: updated.id.toString(),
    rating: updated.rating,
    promptVersion: updated.promptVersion,
  });
}
