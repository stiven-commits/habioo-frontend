import { Fragment, type CSSProperties, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  headerClassName?: string;
  className?: string;
  render: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor: (row: T, index: number) => string | number;
  renderExpandedRow?: (row: T, index: number) => ReactNode | null;
  rowClassName?: string | ((row: T, index: number) => string);
  onRowDoubleClick?: (row: T, index: number) => void;
  renderFooter?: () => ReactNode;
  tableStyle?: CSSProperties;
}

const DEFAULT_ROW_CLASS = 'border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-800/50';

function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos disponibles.',
  keyExtractor,
  renderExpandedRow,
  rowClassName,
  onRowDoubleClick,
  renderFooter,
  tableStyle,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" style={tableStyle}>
        <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`p-3 font-bold uppercase text-[11px] text-gray-500 dark:text-gray-400 ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-donezo-primary" />
                  Cargando...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <Fragment key={keyExtractor(row, index)}>
                <tr
                  className={
                    typeof rowClassName === 'function'
                      ? rowClassName(row, index)
                      : (rowClassName ?? DEFAULT_ROW_CLASS)
                  }
                  onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row, index) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`p-3 ${col.className ?? ''}`}>
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
                {renderExpandedRow?.(row, index)}
              </Fragment>
            ))
          )}
        </tbody>
        {renderFooter && renderFooter()}
      </table>
    </div>
  );
}

export default DataTable;
