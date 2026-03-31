import type { FC, ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

const PageHeader: FC<PageHeaderProps> = ({ title, subtitle, children, actions }) => (
  <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
    <div className="flex items-center gap-2 self-start xl:self-auto whitespace-nowrap">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
      {subtitle && (
        <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-bold text-gray-600 dark:text-gray-200">
          {subtitle}
        </span>
      )}
    </div>
    {children && <div className="flex-1 w-full">{children}</div>}
    {actions && <div className="flex items-center gap-3 w-full xl:w-auto">{actions}</div>}
  </div>
);

export default PageHeader;
