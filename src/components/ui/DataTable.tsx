import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type PaginationState,
  type Row,
  type SortingState,
} from '@tanstack/react-table';
import HabiooLoader from './HabiooLoader';

export interface Column<T> {
  key: string;
  header: ReactNode;
  headerClassName?: string;
  className?: string;
  headerStyle?: CSSProperties;
  cellStyle?: CSSProperties;
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableResizing?: boolean;
  enableSorting?: boolean;
  sortAccessor?: (row: T) => string | number | Date | null | undefined;
  render: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns?: Column<T>[];
  data?: T[] | null;
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor: (row: T, index: number) => string | number;
  renderExpandedRow?: (row: T, index: number) => ReactNode | null;
  rowClassName?: string | ((row: T, index: number) => string);
  onRowDoubleClick?: (row: T, index: number) => void;
  renderFooter?: () => ReactNode;
  tableStyle?: CSSProperties;
  enableTanstackPagination?: boolean;
  enableTanstackSorting?: boolean;
  enableTanstackColumnSizing?: boolean;
  defaultSorting?: SortingState;
  sortPinnedBottomPredicate?: (row: T) => boolean;
  enableVirtualization?: boolean;
  virtualizerHeight?: number;
  estimatedRowHeight?: number;
  virtualizerOverscan?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onVisibleRowsChange?: (rows: T[]) => void;
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
  enableTanstackPagination = false,
  enableTanstackSorting = false,
  enableTanstackColumnSizing = false,
  defaultSorting,
  sortPinnedBottomPredicate,
  enableVirtualization = false,
  virtualizerHeight = 560,
  estimatedRowHeight = 58,
  virtualizerOverscan = 8,
  pageSize = 13,
  pageSizeOptions = [10, 25, 50, 100],
  onVisibleRowsChange,
}: DataTableProps<T>) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeData = Array.isArray(data) ? data : [];
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize }));
  }, [pageSize]);

  const [sorting, setSorting] = useState<SortingState>(defaultSorting ?? []);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // Keep latest column defs in a ref so stable cell/header functions can read them
  // without needing to be recreated on every render.
  const colDefsRef = useRef(safeColumns);
  colDefsRef.current = safeColumns;

  // Keep other props that sortingFn needs in a ref too.
  const tablePropsRef = useRef({ enableTanstackSorting, enableTanstackColumnSizing, sortPinnedBottomPredicate });
  tablePropsRef.current = { enableTanstackSorting, enableTanstackColumnSizing, sortPinnedBottomPredicate };

  // Stable column keys string — only changes when columns are structurally added/removed.
  const colKeysId = safeColumns.map((c) => c.key).join('\x00');

  // tanstackColumns is memoized on column structure (keys), NOT on render functions.
  // This means flexRender always receives the SAME cell/header function references
  // across re-renders, preventing React from unmounting stateful children
  // (e.g. DropdownMenu) just because a parent re-rendered.
  // All dynamic values (render, sortAccessor, etc.) are read via colDefsRef at call time.
  const tanstackColumns = useMemo<ColumnDef<T>[]>(
    () => colDefsRef.current.map((col) => {
      const key = col.key;
      return {
        id: key,
        accessorFn: (row: T) => colDefsRef.current.find((c) => c.key === key)?.sortAccessor?.(row),
        size: col.size,
        minSize: col.minSize,
        maxSize: col.maxSize,
        get enableSorting() {
          const c = colDefsRef.current.find((d) => d.key === key);
          return tablePropsRef.current.enableTanstackSorting && Boolean(c?.enableSorting);
        },
        get enableResizing() {
          const c = colDefsRef.current.find((d) => d.key === key);
          return tablePropsRef.current.enableTanstackColumnSizing && c?.enableResizing !== false;
        },
        sortingFn: (rowA: Row<T>, rowB: Row<T>) => {
          const { sortPinnedBottomPredicate: pred } = tablePropsRef.current;
          if (pred) {
            const aPinned = Boolean(pred(rowA.original));
            const bPinned = Boolean(pred(rowB.original));
            if (aPinned || bPinned) return 0;
          }
          const c = colDefsRef.current.find((d) => d.key === key);
          const aValue = c?.sortAccessor ? c.sortAccessor(rowA.original) : rowA.getValue(key);
          const bValue = c?.sortAccessor ? c.sortAccessor(rowB.original) : rowB.getValue(key);
          if (aValue instanceof Date && bValue instanceof Date) return aValue.getTime() - bValue.getTime();
          if (typeof aValue === 'number' && typeof bValue === 'number') return aValue - bValue;
          return String(aValue ?? '').localeCompare(String(bValue ?? ''), 'es', { numeric: true, sensitivity: 'base' });
        },
        header: () => colDefsRef.current.find((c) => c.key === key)?.header,
        cell: (ctx) => {
          const c = colDefsRef.current.find((d) => d.key === key);
          return c ? c.render(ctx.row.original, ctx.row.index) : null;
        },
        meta: {
          get headerClassName() { return colDefsRef.current.find((c) => c.key === key)?.headerClassName; },
          get className() { return colDefsRef.current.find((c) => c.key === key)?.className; },
          get headerStyle() { return colDefsRef.current.find((c) => c.key === key)?.headerStyle; },
          get cellStyle() { return colDefsRef.current.find((c) => c.key === key)?.cellStyle; },
        },
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colKeysId],
  );

  const table = useReactTable({
    data: safeData,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
    ...(enableTanstackPagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    ...(enableTanstackSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
    ...(enableTanstackPagination ? { onPaginationChange: setPagination } : {}),
    ...(enableTanstackSorting ? { onSortingChange: setSorting } : {}),
    ...(enableTanstackColumnSizing
      ? {
          enableColumnResizing: true,
          columnResizeMode: 'onChange' as const,
          onColumnSizingChange: setColumnSizing,
        }
      : {}),
    state: {
      ...(enableTanstackPagination ? { pagination } : {}),
      ...(enableTanstackSorting ? { sorting } : {}),
      ...(enableTanstackColumnSizing ? { columnSizing } : {}),
    },
  });

  const headerGroup = table.getHeaderGroups()[0];
  const modelRows = enableTanstackPagination
    ? table.getPaginationRowModel().rows
    : table.getRowModel().rows;

  const canVirtualize = enableVirtualization && !loading && !renderExpandedRow && modelRows.length > 0;
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: canVirtualize ? modelRows.length : 0,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: virtualizerOverscan,
    enabled: canVirtualize,
  });

  const virtualItems = canVirtualize ? rowVirtualizer.getVirtualItems() : [];
  const rows = canVirtualize
    ? virtualItems.map((item) => ({ item, row: modelRows[item.index] }))
    : modelRows.map((row) => ({ item: null as null, row }));

  const paddingTop = canVirtualize && virtualItems.length > 0 ? virtualItems[0]?.start ?? 0 : 0;
  const lastVirtual = canVirtualize && virtualItems.length > 0 ? virtualItems[virtualItems.length - 1] : null;
  const paddingBottom = canVirtualize && lastVirtual
    ? Math.max(0, rowVirtualizer.getTotalSize() - lastVirtual.end)
    : 0;

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination?.pageIndex ?? 0;

  useEffect(() => {
    if (!onVisibleRowsChange) return;
    onVisibleRowsChange(modelRows.map((row) => row.original));
  }, [onVisibleRowsChange, modelRows]);

  useEffect(() => {
    if (!enableTanstackPagination) return;
    table.setPageIndex(0);
  }, [safeData.length, enableTanstackPagination, table]);

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-x-auto ${canVirtualize ? 'overflow-y-auto' : ''}`}
      style={canVirtualize ? { maxHeight: `${virtualizerHeight}px` } : undefined}
    >
      <table className="w-full border-collapse text-left text-sm" style={tableStyle}>
        <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {headerGroup?.headers.map((header) => {
              const meta = (header.column.columnDef.meta ?? {}) as {
                headerClassName?: string;
                headerStyle?: CSSProperties;
              };
              return (
                <th
                  key={header.id}
                  className={`p-3 font-bold uppercase text-[11px] text-gray-500 dark:text-gray-400 ${meta.headerClassName ?? ''}`}
                  style={{
                    ...meta.headerStyle,
                    width: header.getSize(),
                    minWidth: header.column.columnDef.minSize,
                    maxWidth: header.column.columnDef.maxSize,
                  }}
                >
                  <div className="relative flex items-center">
                    {header.isPlaceholder ? null : (
                      header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex w-full items-center justify-start gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="shrink-0">
                            {header.column.getIsSorted() === 'asc'
                              ? '↑'
                              : header.column.getIsSorted() === 'desc'
                                ? '↓'
                                : '↕'}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )
                    )}
                    {enableTanstackColumnSizing && header.column.getCanResize() && (
                      <span
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none ${
                          header.column.getIsResizing() ? 'bg-blue-200/70 dark:bg-blue-700/60' : 'hover:bg-gray-300/40 dark:hover:bg-gray-600/40'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={Math.max(safeColumns.length, 1)} className="h-44 p-0 align-middle">
                <HabiooLoader size="sm" message="" className="h-full py-0" />
              </td>
            </tr>
          ) : safeData.length === 0 ? (
            <tr>
              <td colSpan={Math.max(safeColumns.length, 1)} className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            <>
              {canVirtualize && paddingTop > 0 && (
                <tr>
                  <td colSpan={Math.max(safeColumns.length, 1)} style={{ height: `${paddingTop}px` }} className="p-0 border-0" />
                </tr>
              )}
              {rows.map(({ row, item }) => (
                <Fragment key={keyExtractor(row.original, row.index)}>
                  <tr
                    data-index={item ? item.index : undefined}
                    ref={item ? (node) => { if (node) rowVirtualizer.measureElement(node); } : undefined}
                    className={
                      typeof rowClassName === 'function'
                        ? rowClassName(row.original, row.index)
                        : (rowClassName ?? DEFAULT_ROW_CLASS)
                    }
                    onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row.original, row.index) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = (cell.column.columnDef.meta ?? {}) as {
                        className?: string;
                        cellStyle?: CSSProperties;
                      };
                      return (
                        <td
                          key={cell.id}
                          className={`p-3 ${meta.className ?? ''}`}
                          style={{
                            ...meta.cellStyle,
                            width: cell.column.getSize(),
                            minWidth: cell.column.columnDef.minSize,
                            maxWidth: cell.column.columnDef.maxSize,
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                  {renderExpandedRow?.(row.original, row.index)}
                </Fragment>
              ))}
              {canVirtualize && paddingBottom > 0 && (
                <tr>
                  <td colSpan={Math.max(safeColumns.length, 1)} style={{ height: `${paddingBottom}px` }} className="p-0 border-0" />
                </tr>
              )}
            </>
          )}
        </tbody>
        {renderFooter && renderFooter()}
      </table>
      {enableTanstackPagination && !loading && safeData.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Filas por página</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
                table.setPageIndex(0);
              }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-gray-600 dark:text-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
            >
              {(pageSizeOptions.includes(table.getState().pagination.pageSize)
                ? pageSizeOptions
                : [...pageSizeOptions, table.getState().pagination.pageSize].sort((a, b) => a - b)
              ).map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400 dark:text-gray-500">{safeData.length} registros</span>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Página {pageIndex + 1} de {pageCount}
              </span>
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-4 py-1.5 rounded-lg text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-4 py-1.5 rounded-lg text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DataTable;
