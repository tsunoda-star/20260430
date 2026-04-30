'use client';

import type { ReactNode } from 'react';
import { useRole } from '@/lib/auth/role-context';
import type { PermissionAction } from '@/lib/server/permissions';

/**
 * 子要素の表示を権限で制御するラッパー。
 *
 * mode='hide'      — 不可なら children を非表示 (DOM から除去)
 * mode='disable'   — 不可なら disabled 属性を伝播 (form/button 用; render-prop)
 *
 * 信頼境界はサーバー側。本コンポーネントは UX のみ。
 */

interface BaseProps {
  action: PermissionAction;
  /** 不可時の代替表示 (なし時は何も表示しない) */
  fallback?: ReactNode;
}

interface HideProps extends BaseProps {
  mode?: 'hide';
  children: ReactNode;
}

interface DisableProps extends BaseProps {
  mode: 'disable';
  /** disabled / reason をマージするレンダラー */
  children: (state: { disabled: boolean; reason: string | null }) => ReactNode;
}

export type RoleGateProps = HideProps | DisableProps;

export function RoleGate(props: RoleGateProps): JSX.Element | null {
  const { can, why } = useRole();
  const allowed = can(props.action);
  const reason = why(props.action);

  if (props.mode === 'disable') {
    return <>{props.children({ disabled: !allowed, reason })}</>;
  }
  if (allowed) return <>{props.children}</>;
  if (props.fallback !== undefined) return <>{props.fallback}</>;
  return null;
}
