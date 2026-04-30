'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { useRole } from '@/lib/auth/role-context';
import type { PermissionAction } from '@/lib/server/permissions';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 権限に応じて自動的に disabled / 低彩度 / tooltip を付与するボタン.
 * spec.md §6.3: クライアントは UX のみ. 信頼境界はサーバー requireAction。
 *
 * - 不可時: disabled + opacity-60 + cursor-not-allowed + title 属性に理由
 * - aria-disabled / aria-describedby を設定
 */

export interface DisabledActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  action: PermissionAction;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}

export const DisabledActionButton = forwardRef<HTMLButtonElement, DisabledActionButtonProps>(
  ({ action, className, children, ...props }, ref) => {
    const { can, why } = useRole();
    const allowed = can(action);
    const reason = why(action);
    return (
      <Button
        ref={ref}
        type={props.type ?? 'button'}
        disabled={!allowed}
        aria-disabled={!allowed}
        title={!allowed && reason ? reason : undefined}
        className={cn(!allowed && 'cursor-not-allowed opacity-60 saturate-50', className)}
        {...props}
      >
        {children}
      </Button>
    );
  },
);
DisabledActionButton.displayName = 'DisabledActionButton';
