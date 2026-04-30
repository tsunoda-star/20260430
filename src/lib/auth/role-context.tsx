'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ACTION_LABELS_JA,
  PERMISSION_MATRIX,
  whyNotAllowedJa,
  type PermissionAction,
} from '@/lib/server/permissions';
import type { UserRole } from '@/lib/auth/session';

/**
 * クライアント側 useRole フック.
 * spec.md §6.3: UI disabled / 非表示用 (信頼境界はサーバー側 requireAction)。
 *
 * - 起動時に GET /api/v1/me を 1 回叩いてセッションを取得し、Provider に保存
 * - 以降は permissions Set からの O(1) 参照
 * - 401 が返れば user=null (未ログイン状態)
 */

export interface MeProfile {
  sub: string;
  email: string;
  name?: string;
  orgId: string;
  role: UserRole;
  /** サーバー側で計算された許可操作の一覧 */
  permissions: PermissionAction[];
}

export type RoleContextValue =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; profile: MeProfile; permissions: ReadonlySet<PermissionAction> };

const RoleContext = createContext<RoleContextValue>({ status: 'loading' });

export interface RoleProviderProps {
  children: ReactNode;
  /** SSR 時に既知のプロフィール (skip fetch) */
  initialProfile?: MeProfile | null;
  /** テスト時に fetch を差し替え可能 */
  fetcher?: typeof fetch;
}

export function RoleProvider({
  children,
  initialProfile,
  fetcher,
}: RoleProviderProps): JSX.Element {
  const [state, setState] = useState<RoleContextValue>(() =>
    initialProfile === undefined
      ? { status: 'loading' }
      : initialProfile === null
        ? { status: 'unauthenticated' }
        : {
            status: 'authenticated',
            profile: initialProfile,
            permissions: new Set(initialProfile.permissions),
          },
  );

  useEffect(() => {
    if (state.status !== 'loading') return;
    const f = fetcher ?? fetch;
    let cancelled = false;
    void (async () => {
      try {
        const res = await f('/api/v1/me', { credentials: 'same-origin' });
        if (cancelled) return;
        if (res.status === 401) {
          setState({ status: 'unauthenticated' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'unauthenticated' });
          return;
        }
        const profile = (await res.json()) as MeProfile;
        setState({
          status: 'authenticated',
          profile,
          permissions: new Set(profile.permissions),
        });
      } catch {
        if (!cancelled) setState({ status: 'unauthenticated' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, fetcher]);

  return <RoleContext.Provider value={state}>{children}</RoleContext.Provider>;
}

export interface UseRoleReturn {
  status: RoleContextValue['status'];
  profile: MeProfile | null;
  role: UserRole | null;
  /** 操作が許可されているか */
  can: (action: PermissionAction) => boolean;
  /** 操作が disabled な場合の理由 (許可時 null) */
  why: (action: PermissionAction) => string | null;
}

export function useRole(): UseRoleReturn {
  const ctx = useContext(RoleContext);
  return useMemo<UseRoleReturn>(() => {
    if (ctx.status !== 'authenticated') {
      return {
        status: ctx.status,
        profile: null,
        role: null,
        can: () => false,
        why: (a) => `${ACTION_LABELS_JA[a]} はログインが必要です`,
      };
    }
    return {
      status: 'authenticated',
      profile: ctx.profile,
      role: ctx.profile.role,
      can: (a) => ctx.permissions.has(a),
      why: (a) =>
        ctx.permissions.has(a) ? null : whyNotAllowedJa(ctx.profile.role, a),
    };
  }, [ctx]);
}

export { PERMISSION_MATRIX, ACTION_LABELS_JA };
export type { PermissionAction };
