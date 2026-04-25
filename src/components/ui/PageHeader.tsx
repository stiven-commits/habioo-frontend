import { Children, Fragment, cloneElement, isValidElement } from 'react';
import type { FC, ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  verticalActionsOnMobile?: boolean;
}

const PageHeader: FC<PageHeaderProps> = ({ title, subtitle, children, actions, verticalActionsOnMobile = false }) => {
  const flattenActionNodes = (nodes: ReactNode): ReactNode[] => {
    const result: ReactNode[] = [];
    Children.forEach(nodes, (node) => {
      if (!node) return;
      if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
        result.push(...flattenActionNodes(node.props.children));
        return;
      }
      result.push(node);
    });
    return result;
  };

  const actionItems = flattenActionNodes(actions);
  const hasSearch = Boolean(children);
  const hasMultipleActions = actionItems.length > 1;
  const totalActions = actionItems.length;

  const actionBaseClassName = 'inline-flex items-center justify-center gap-2 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 transition-colors shadow-[0_14px_30px_-14px_rgba(16,185,129,0.8)]';

  const sanitizeActionClassName = (raw: string): string => {
    const dropPrefixes = [
      'bg-',
      'text-',
      'border-',
      'rounded',
      'shadow',
      'hover:bg-',
      'hover:text-',
      'hover:border-',
      'dark:bg-',
      'dark:text-',
      'dark:border-',
      'dark:hover:bg-',
      'dark:hover:text-',
      'dark:hover:border-',
    ];

    return raw
      .split(/\s+/)
      .filter((token) => token && !dropPrefixes.some((prefix) => token.startsWith(prefix)))
      .join(' ');
  };

  const normalizedActions = actionItems.map((action, index) => {
    if (!isValidElement<{ className?: string }>(action) || action.type !== 'button') {
      return action;
    }

    const currentClassName = sanitizeActionClassName(String(action.props.className || ''));
    const shapeClassName = hasMultipleActions
      ? verticalActionsOnMobile
        ? `rounded-none md:rounded-none ${index === 0 ? 'rounded-t-xl md:rounded-t-none md:rounded-l-xl border-t-0 md:border-l-0' : ''} ${index === totalActions - 1 ? 'rounded-b-xl md:rounded-b-none md:rounded-r-xl' : ''} border-t border-emerald-800/35 md:border-t-0 md:border-l shadow-none`
        : `rounded-none ${index === 0 ? 'rounded-l-xl border-l-0' : ''} ${index === totalActions - 1 ? 'rounded-r-xl' : ''} border-l border-emerald-800/35 shadow-none`
      : 'rounded-xl';

    return cloneElement(action, {
      className: `${currentClassName} ${actionBaseClassName} ${shapeClassName}`.trim(),
    });
  });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark xl:flex-row xl:items-end">
      <div className="min-w-0">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        )}
      </div>

      {hasSearch && (
        <div className="w-full xl:flex-1 xl:pb-0.5">
          {children}
        </div>
      )}

      {actionItems.length > 0 && (
        <div className={`w-full xl:w-auto ${hasSearch ? '' : 'xl:ml-auto'} flex justify-start xl:justify-end`}>
          {hasMultipleActions ? (
            <div className={`${verticalActionsOnMobile ? 'inline-flex w-full flex-col md:flex-row items-stretch overflow-hidden rounded-xl border border-emerald-800/25 xl:w-auto' : 'inline-flex w-full flex-wrap items-stretch overflow-hidden rounded-xl border border-emerald-800/25 xl:w-auto'}`}>
              {normalizedActions}
            </div>
          ) : (
            normalizedActions
          )}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
