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
import { ChevronRight } from 'lucide-react';
import HabiooLoader from './HabiooLoader';

export interface Column<T> {
  key: string;
  header: ReactNode;
  headerClassName?: string;
  className?: string;
  hideOnMobile?: boolean;
  keepVisible?: boolean;
  headerStyle?: CSSProperties;
  cellStyle?: CSSProperties;
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableResizing?: boolean;
  enableSorting?: boolean;
  sortAccessor?: (row: T) => string | number | Date | null | undefined;
  render: (row: T, index: number, context?: {
    hiddenColumnKeys: ReadonlySet<string>;
    visibleColumnCount: number;
    hasHiddenColumns: boolean;
  }) => ReactNode;
}

interface DataTableProps<T> {
  columns?: Column<T>[];
  data?: T[] | null;
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor: (row: T, index: number) => string | number;
  renderExpandedRow?: (row: T, index: number, context?: {
    hiddenColumns: Array<{
      key: string;
      headerLabel: string;
      value: ReactNode;
    }>;
    hiddenColumnKeys: ReadonlySet<string>;
    visibleColumnCount: number;
    hasHiddenColumns: boolean;
  }) => ReactNode | null;
  rowClassName?: string | ((row: T, index: number) => string);
  onRowDoubleClick?: (row: T, index: number) => void;
  renderFooter?: (context?: {
    hiddenColumnKeys: ReadonlySet<string>;
    visibleColumnCount: number;
    hasHiddenColumns: boolean;
  }) => ReactNode;
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

const toHeaderLabel = (key: string, header: ReactNode): string => {
  if (typeof header === 'string' || typeof header === 'number') return String(header);
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

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
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [containerWidth, setContainerWidth] = useState(0);

  const toggleRow = (rowIndex: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  // Keep latest column defs in a ref so stable cell/header functions can read them
  // without needing to be recreated on every render.
  const colDefsRef = useRef(safeColumns);
  colDefsRef.current = safeColumns;

  // Keep other props that sortingFn needs in a ref too.
  const tablePropsRef = useRef({ enableTanstackSorting, enableTanstackColumnSizing, sortPinnedBottomPredicate });
  tablePropsRef.current = { enableTanstackSorting, enableTanstackColumnSizing, sortPinnedBottomPredicate };

  // Stable column keys string — only changes when columns are structurally added/removed.
  const colKeysId = safeColumns.map((c) => c.key).join('\x00');
  const widthSignature = safeColumns
    .map((column) => `${column.key}:${column.minSize ?? ''}:${column.size ?? ''}:${column.maxSize ?? ''}`)
    .join('\x00');
  const canCollapseColumns = safeColumns.length > 1;
  const hasPriorityResponsiveColumns = safeColumns.some((column) => column.hideOnMobile);
  const hasKeepVisibleColumns = safeColumns.some((column) => column.keepVisible);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const element = scrollElementRef.current;
    if (!element) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 0);
      setContainerWidth(nextWidth);
    });
    resizeObserver.observe(element);
    setContainerWidth(Math.floor(element.getBoundingClientRect().width));
    return () => resizeObserver.disconnect();
  }, []);

  const getColumnEstimatedWidth = (column: Column<T>): number => {
    // Keep the estimate realistic to avoid hiding columns too early.
    // We still include horizontal cell padding, but avoid overestimating.
    const baseWidth = column.size ?? column.minSize ?? 120;
    return Math.max(64, baseWidth) + 24;
  };

  const responsiveHiddenColumnKeys = useMemo(() => {
    if (!canCollapseColumns || containerWidth <= 0) return new Set<string>();

    let requiredWidth = safeColumns.reduce((total, column) => total + getColumnEstimatedWidth(column), 0);
    if (requiredWidth <= containerWidth) return new Set<string>();

    const hiddenKeys = new Set<string>();
    if (hasPriorityResponsiveColumns) {
      for (let index = safeColumns.length - 1; index >= 0 && requiredWidth > containerWidth; index -= 1) {
        const column = safeColumns[index];
        if (!column?.hideOnMobile || column.keepVisible) continue;
        hiddenKeys.add(column.key);
        requiredWidth -= getColumnEstimatedWidth(column);
      }
    }

    // If the table still overflows after hiding preferred responsive columns,
    // keep collapsing from right to left with the remaining columns
    // (preserving at least the first column as visible anchor).
    const minIndexToPreserve = hasKeepVisibleColumns ? 0 : 1;
    for (let index = safeColumns.length - 1; index >= minIndexToPreserve && requiredWidth > containerWidth; index -= 1) {
      const column = safeColumns[index];
      if (!column || hiddenKeys.has(column.key) || column.keepVisible) continue;
      hiddenKeys.add(column.key);
      requiredWidth -= getColumnEstimatedWidth(column);
    }

    if (!hasKeepVisibleColumns) {
      // Emergency fallback: if width is still insufficient and there are no
      // keepVisible columns, collapse remaining columns from right to left
      // while preserving at least the first column.
      for (let index = safeColumns.length - 1; index >= 1 && requiredWidth > containerWidth; index -= 1) {
        const column = safeColumns[index];
        if (!column || hiddenKeys.has(column.key)) continue;
        hiddenKeys.add(column.key);
        requiredWidth -= getColumnEstimatedWidth(column);
      }
    }

    return hiddenKeys;
  }, [canCollapseColumns, containerWidth, hasKeepVisibleColumns, hasPriorityResponsiveColumns, safeColumns, widthSignature]);

  const hasHiddenColumns = responsiveHiddenColumnKeys.size > 0;
  const visibleColumnsCount = Math.max(
    safeColumns.filter((column) => !responsiveHiddenColumnKeys.has(column.key)).length,
    1,
  );
  const useResponsiveFluidLayout = hasHiddenColumns;

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
          return c
            ? c.render(ctx.row.original, ctx.row.index, {
                hiddenColumnKeys: responsiveHiddenColumnKeys,
                visibleColumnCount: visibleColumnsCount,
                hasHiddenColumns,
              })
            : null;
        },
        meta: {
          get headerClassName() { return colDefsRef.current.find((c) => c.key === key)?.headerClassName; },
          get className() { return colDefsRef.current.find((c) => c.key === key)?.className; },
          get hideOnMobile() { return colDefsRef.current.find((c) => c.key === key)?.hideOnMobile; },
          get headerStyle() { return colDefsRef.current.find((c) => c.key === key)?.headerStyle; },
          get cellStyle() { return colDefsRef.current.find((c) => c.key === key)?.cellStyle; },
        },
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colKeysId, hasHiddenColumns, responsiveHiddenColumnKeys, visibleColumnsCount],
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

  const canVirtualize = enableVirtualization && !loading && !renderExpandedRow && !hasHiddenColumns && modelRows.length > 0;
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

  useEffect(() => {
    setExpandedRows(new Set());
  }, [safeData.length, colKeysId]);

  return (
    <div
      ref={scrollElementRef}
      className={`w-full min-w-0 max-w-full ${useResponsiveFluidLayout ? 'overflow-x-clip' : 'overflow-x-auto'} ${canVirtualize ? 'overflow-y-auto' : ''}`}
      style={canVirtualize ? { maxHeight: `${virtualizerHeight}px` } : undefined}
    >
      <table
        className="w-full max-w-full border-collapse text-left text-sm"
        style={{
          ...tableStyle,
          ...(useResponsiveFluidLayout ? { tableLayout: 'fixed' } : {}),
        }}
      >
        <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {headerGroup?.headers.map((header) => {
              const meta = (header.column.columnDef.meta ?? {}) as {
                headerClassName?: string;
                hideOnMobile?: boolean;
                headerStyle?: CSSProperties;
              };
              const headerClassName = meta.headerClassName ?? '';
              const responsiveHeaderClass = responsiveHiddenColumnKeys.has(header.column.id) ? 'hidden' : '';
              const isRightAlignedHeader = /\btext-right\b/.test(headerClassName);
              const sortJustifyClass = isRightAlignedHeader
                ? 'justify-end'
                : /\btext-center\b/.test(headerClassName)
                  ? 'justify-center'
                  : 'justify-start';
              const headerContentSpacingClass = isRightAlignedHeader ? 'pr-4' : '';
              return (
                <th
                  key={header.id}
                  className={`p-3 font-bold uppercase text-fluid-xs text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600 last:border-r-0 ${responsiveHeaderClass} ${headerClassName}`}
                  style={{
                    ...meta.headerStyle,
                    ...(!useResponsiveFluidLayout
                      ? {
                          width: header.getSize(),
                          minWidth: header.column.columnDef.minSize,
                          maxWidth: header.column.columnDef.maxSize,
                        }
                      : {}),
                  }}
                >
                  <div className="relative flex items-center">
                    {header.isPlaceholder ? null : (
                      header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={`inline-flex w-full items-center ${sortJustifyClass} ${headerContentSpacingClass} gap-1 hover:text-gray-700 dark:hover:text-gray-200`}
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
                        <div className={`flex w-full items-center ${sortJustifyClass} ${headerContentSpacingClass}`}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      )
                    )}
                    {enableTanstackColumnSizing && header.column.getCanResize() && (
                      <span
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute right-0 top-0 h-full w-3 cursor-col-resize select-none touch-none ${
                          header.column.getIsResizing() ? 'bg-blue-200/70 dark:bg-blue-700/60' : 'hover:bg-gray-300/40 dark:hover:bg-gray-600/40'
                        }`}
                        title="Arrastrar para ajustar ancho de columna"
                        aria-hidden="true"
                      >
                        <span className="pointer-events-none absolute right-[3px] top-1/2 -translate-y-1/2 text-[10px] leading-none text-gray-400 dark:text-gray-500">
                          ||
                        </span>
                      </span>
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
                  {(() => {
                    const cells = row.getVisibleCells();
                    const dateAnchorCellId = cells.find(
                      (cell) => !responsiveHiddenColumnKeys.has(cell.column.id) && /fecha/i.test(cell.column.id),
                    )?.id;
                    const conceptAnchorCellId = cells.find(
                      (cell) => !responsiveHiddenColumnKeys.has(cell.column.id) && /concept/i.test(cell.column.id),
                    )?.id;
                    const firstVisibleCellId = cells.find((cell) => !responsiveHiddenColumnKeys.has(cell.column.id))?.id;
                    const toggleAnchorCellId = visibleColumnsCount <= 2
                      ? (conceptAnchorCellId ?? dateAnchorCellId ?? firstVisibleCellId)
                      : (dateAnchorCellId ?? firstVisibleCellId);
                    return (
                      <>
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
                    {cells.map((cell) => {
                      const meta = (cell.column.columnDef.meta ?? {}) as {
                        className?: string;
                        cellStyle?: CSSProperties;
                      };
                      const isHiddenCell = responsiveHiddenColumnKeys.has(cell.column.id);
                      const isPrimaryCell = !isHiddenCell && cell.id === toggleAnchorCellId;
                      return (
                        <td
                          key={cell.id}
                          className={`p-3 ${isHiddenCell ? 'hidden' : ''} ${useResponsiveFluidLayout ? 'min-w-0 overflow-hidden' : ''} ${meta.className ?? ''}`}
                          style={{
                            ...meta.cellStyle,
                            ...(!useResponsiveFluidLayout
                              ? {
                                  width: cell.column.getSize(),
                                  minWidth: cell.column.columnDef.minSize,
                                  maxWidth: cell.column.columnDef.maxSize,
                                }
                              : {}),
                          }}
                        >
                          <div className={isPrimaryCell ? 'flex items-start gap-2' : undefined}>
                            {isPrimaryCell && hasHiddenColumns && !renderExpandedRow && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleRow(row.index);
                                }}
                                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-transparent bg-donezo-primary text-white transition-colors hover:bg-green-700"
                                aria-label={expandedRows.has(row.index) ? 'Ocultar detalles' : 'Mostrar detalles'}
                                aria-expanded={expandedRows.has(row.index)}
                              >
                                <ChevronRight
                                  size={12}
                                  className={`text-white transition-transform duration-200 ${expandedRows.has(row.index) ? 'rotate-90' : ''}`}
                                />
                              </button>
                            )}
                            <div className={`min-w-0 flex-1 ${useResponsiveFluidLayout ? 'overflow-hidden' : ''}`}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {hasHiddenColumns && !renderExpandedRow && expandedRows.has(row.index) && (
                    <tr>
                      <td colSpan={visibleColumnsCount} className="bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900/40">
                        <div className="grid gap-2">
                          {cells
                            .filter((cell) => responsiveHiddenColumnKeys.has(cell.column.id))
                            .map((cell) => {
                              const header = headerGroup?.headers.find((candidate) => candidate.column.id === cell.column.id);
                              const headerNode = header ? flexRender(header.column.columnDef.header, header.getContext()) : cell.column.id;
                              const headerLabel = toHeaderLabel(cell.column.id, headerNode);
                              return (
                                <div
                                  key={`${cell.id}-mobile-details`}
                                  className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-3 gap-y-1 border-b border-gray-200/70 pb-2 last:border-b-0 last:pb-0 dark:border-gray-700/70"
                                >
                                  <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {headerLabel}
                                  </div>
                                  <div className="min-w-0 text-gray-700 dark:text-gray-200">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </td>
                    </tr>
                  )}
                  {renderExpandedRow?.(row.original, row.index, {
                    hiddenColumns: cells
                      .filter((cell) => responsiveHiddenColumnKeys.has(cell.column.id))
                      .map((cell) => {
                        const header = headerGroup?.headers.find((candidate) => candidate.column.id === cell.column.id);
                        const headerNode = header ? flexRender(header.column.columnDef.header, header.getContext()) : cell.column.id;
                        return {
                          key: cell.column.id,
                          headerLabel: toHeaderLabel(cell.column.id, headerNode),
                          value: flexRender(cell.column.columnDef.cell, cell.getContext()),
                        };
                      }),
                    hiddenColumnKeys: responsiveHiddenColumnKeys,
                    visibleColumnCount: visibleColumnsCount,
                    hasHiddenColumns,
                  })}
                      </>
                    );
                  })()}
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
        {renderFooter && renderFooter({
          hiddenColumnKeys: responsiveHiddenColumnKeys,
          visibleColumnCount: visibleColumnsCount,
          hasHiddenColumns,
        })}
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
