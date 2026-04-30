import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { problemResponse } from '@/lib/server/problem-details';
import { getSessionFromRequest } from '@/lib/server/session';
import { PERMISSION_MATRIX, type PermissionAction } from '@/lib/server/permissions';

/**
 * GET /api/v1/me
 * 現在のセッションユーザーと、許可されている操作 (PermissionAction[]) を返す。
 * クライアントの useRole hook が起動時に 1 度だけ叩く。
 */
export const runtime = 'nodejs';

interface MeResponse {
  sub: string;
  email: string;
  name?: string;
  orgId: string;
  role: string;
  /** spec.md §6.2 マトリクスに基づき、現在許可されている操作の一覧 */
  permissions: PermissionAction[];
}

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getSessionFromRequest(req);
  if (!user) return problemResponse('unauthorized');

  const permissions = (Object.keys(PERMISSION_MATRIX) as PermissionAction[]).filter((a) =>
    PERMISSION_MATRIX[a].includes(user.role),
  );

  const body: MeResponse = {
    sub: user.sub,
    email: user.email,
    name: user.name,
    orgId: user.orgId,
    role: user.role,
    permissions,
  };
  return NextResponse.json(body);
}
