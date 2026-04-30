/**
 * Prisma client extension の純粋ロジック層 (テスト容易化のため分離).
 * テナント越え参照を実行時に検知するガード。
 *
 * 対象は tenantId カラムを持つモデルのみ。Prisma の `model` 名は
 * 生成された JS 名 (PascalCase) で渡されるため、それで判定する。
 */

/** spec.md §2 の tenant-scoped モデル一覧 */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
  'User',
  'Company',
  'Assessment',
  'AssessmentItem',
  'AiChat',
  'AuditLog',
]);

interface FindArgsWhere {
  where?: Record<string, unknown> | null;
}

export class TenantScopeViolation extends Error {
  readonly model: string;
  readonly operation: string;
  constructor(model: string, operation: string) {
    super(
      `tenantId is required when calling ${model}.${operation} (tenant-scope violation)`,
    );
    this.name = 'TenantScopeViolation';
    this.model = model;
    this.operation = operation;
  }
}

/**
 * args.where に tenantId が含まれているか確認する。
 * `where: { tenantId: 1n }` 直接指定 / `where: { AND: [...] }` のネストいずれかで OK。
 *
 * tenant-scoped でないモデル / args が undefined のクエリは素通し。
 */
export function assertTenantScoped<TArgs extends FindArgsWhere | undefined>(
  model: string | undefined,
  operation: string,
  args: TArgs,
): void {
  if (!model || !TENANT_SCOPED_MODELS.has(model)) return;
  if (!args) {
    throw new TenantScopeViolation(model, operation);
  }
  const where = (args as FindArgsWhere).where;
  if (!where) {
    throw new TenantScopeViolation(model, operation);
  }
  if (containsTenantId(where)) return;
  throw new TenantScopeViolation(model, operation);
}

function containsTenantId(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false;
  const obj = where as Record<string, unknown>;
  if ('tenantId' in obj && obj.tenantId !== undefined) return true;
  // AND / OR ネスト
  for (const key of ['AND', 'OR']) {
    const arr = obj[key];
    if (!Array.isArray(arr)) continue;
    for (const sub of arr) {
      if (containsTenantId(sub)) return true;
    }
  }
  return false;
}
