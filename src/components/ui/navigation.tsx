import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Navigation primitive — Linear 風シャープ・ミニマルナビ (design-system.yml references[1])
 * 個別のサイドナビ・ヘッダは Wave 2 で具体実装。ここでは a11y プリミティブのみ。
 */
const NavigationRoot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="Primary"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    >
      {children}
    </nav>
  ),
);
NavigationRoot.displayName = 'NavigationRoot';

const NavigationList = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} role="list" className={cn('flex flex-col gap-1', className)} {...props} />
  ),
);
NavigationList.displayName = 'NavigationList';

const NavigationItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn(className)} {...props} />,
);
NavigationItem.displayName = 'NavigationItem';

interface NavigationLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
}

const NavigationLink = React.forwardRef<HTMLAnchorElement, NavigationLinkProps>(
  ({ className, active = false, children, ...props }, ref) => (
    <a
      ref={ref}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors duration-base',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  ),
);
NavigationLink.displayName = 'NavigationLink';

export { NavigationRoot, NavigationList, NavigationItem, NavigationLink };
