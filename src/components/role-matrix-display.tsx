import { Check, X } from 'lucide-react';
import {
  PERMISSION_MATRIX,
  ACTION_LABELS_JA,
  type PermissionAction,
} from '@/lib/server/permissions';
import { cn } from '@/lib/utils';
import { ResponsiveTable } from './responsive-table';

/**
 * spec.md §6.2 + Cycle 4.5: 5ロール権限マトリクスを SSR で描画.
 *
 * - サーバー Component (信頼可能な PERMISSION_MATRIX を直接読み込み)
 * - レスポンシブ: モバイルは action 単位でカード列挙
 * - aria-label / WCAG コントラスト準拠
 */

const ROLES = ['owner', 'admin', 'editor', 'reviewer', 'viewer'] as const;

const ROLE_LABEL_JA: Record<(typeof ROLES)[number], string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  reviewer: 'Reviewer',
  viewer: 'Viewer',
};

const ACTIONS = Object.keys(PERMISSION_MATRIX) as PermissionAction[];

function CheckCell({ allowed }: { allowed: boolean }): JSX.Element {
  return allowed ? (
    <Check className="size-4 text-accent" aria-label="可" />
  ) : (
    <X className="size-4 text-muted-foreground" aria-label="不可" />
  );
}

export interface RoleMatrixDisplayProps {
  className?: string;
}

export function RoleMatrixDisplay({ className }: RoleMatrixDisplayProps): JSX.Element {
  const tableView = (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm" aria-label="5ロール権限マトリクス">
        <thead>
          <tr>
            <th className="bg-secondary/40 px-3 py-2 text-left font-semibold text-foreground">
              操作
            </th>
            {ROLES.map((r) => (
              <th
                key={r}
                scope="col"
                className="bg-secondary/40 px-3 py-2 text-center font-semibold text-foreground"
              >
                {ROLE_LABEL_JA[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ACTIONS.map((a) => (
            <tr key={a} className="border-b border-border last:border-b-0">
              <th
                scope="row"
                className="px-3 py-2 text-left font-medium text-foreground"
              >
                {ACTION_LABELS_JA[a]}
              </th>
              {ROLES.map((r) => (
                <td key={r} className="px-3 py-2 text-center">
                  <span className="inline-flex">
                    <CheckCell allowed={PERMISSION_MATRIX[a].includes(r)} />
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const cardView = (
    <ul className="space-y-3" aria-label="5ロール権限 (モバイル簡略表示)">
      {ACTIONS.map((a) => {
        const allowed = PERMISSION_MATRIX[a];
        return (
          <li
            key={a}
            className="rounded-md border border-border bg-card p-3 text-card-foreground shadow-sm"
          >
            <p className="font-medium text-foreground">{ACTION_LABELS_JA[a]}</p>
            <p className="mt-1 flex flex-wrap gap-1 text-xs">
              {ROLES.map((r) => (
                <span
                  key={r}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
                    allowed.includes(r)
                      ? 'bg-accent/15 text-accent'
                      : 'bg-secondary text-muted-foreground line-through',
                  )}
                >
                  <span aria-hidden="true">
                    {allowed.includes(r) ? '✓' : '×'}
                  </span>
                  {ROLE_LABEL_JA[r]}
                </span>
              ))}
            </p>
          </li>
        );
      })}
    </ul>
  );

  return <ResponsiveTable className={className} table={tableView} cards={cardView} />;
}
