import React, { useState, useRef } from 'react';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  numeric?: boolean;
}

interface ResizableTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}

interface TableRowProps<T> {
  row: T;
  columns: ColumnDef<T>[];
  columnWidths: Record<string, number>;
  onRowClick?: (row: T) => void;
}

function TableRowInner<T>({
  row,
  columns,
  columnWidths,
  onRowClick
}: TableRowProps<T>) {
  return (
    <tr
      onClick={() => onRowClick && onRowClick(row)}
      style={{
        borderBottom: '1px solid var(--color-border-subtle)',
        cursor: onRowClick ? 'pointer' : 'default',
        transition: 'background-color var(--transition-fast)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {columns.map((col) => {
        const width = columnWidths[col.id] || col.width || 150;
        return (
          <td
            key={col.id}
            style={{
              width: `${width}px`,
              padding: 'var(--space-3) var(--space-4)',
              textAlign: col.numeric ? 'right' : 'left',
              color: 'var(--color-text-primary)',
              fontFamily: col.numeric ? 'var(--font-mono)' : 'var(--font-sans)',
              fontVariantNumeric: col.numeric ? 'tabular-nums lining-nums' : 'normal',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {col.accessor(row)}
          </td>
        );
      })}
    </tr>
  );
}

const TableRow = React.memo(TableRowInner) as typeof TableRowInner;

export function ResizableTable<T>({
  columns: initialColumns,
  data,
  keyExtractor,
  isLoading = false,
  isError = false,
  errorMessage,
  emptyTitle,
  emptyDescription,
  onRowClick
}: ResizableTableProps<T>) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    initialColumns.forEach((col) => {
      initial[col.id] = col.width || 150;
    });
    return initial;
  });

  const activeResizer = useRef<{
    colId: string;
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent, col: ColumnDef<T>) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = columnWidths[col.id] || col.width || 150;

    activeResizer.current = {
      colId: col.id,
      startX,
      startWidth,
      minWidth: col.minWidth || 60,
      maxWidth: col.maxWidth || 800
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!activeResizer.current) return;
      const deltaX = moveEvent.clientX - activeResizer.current.startX;
      const newWidth = Math.max(
        activeResizer.current.minWidth,
        Math.min(activeResizer.current.maxWidth, activeResizer.current.startWidth + deltaX)
      );

      setColumnWidths((prev) => ({
        ...prev,
        [activeResizer.current!.colId]: newWidth
      }));
    };

    const handleMouseUp = () => {
      activeResizer.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (isLoading) {
    return <LoadingState rows={5} />;
  }

  if (isError) {
    return <ErrorState message={errorMessage} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-surface)'
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontSize: 'var(--font-size-base)'
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              borderBottom: '1px solid var(--color-border)',
              position: 'sticky',
              top: 0,
              zIndex: 'var(--z-sticky)'
            }}
          >
            {initialColumns.map((col) => {
              const width = columnWidths[col.id] || col.width || 150;
              return (
                <th
                  key={col.id}
                  style={{
                    width: `${width}px`,
                    padding: 'var(--space-3) var(--space-4)',
                    textAlign: col.numeric ? 'right' : 'left',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    position: 'relative',
                    userSelect: 'none'
                  }}
                >
                  {col.header}
                  {/* Resizer Handle */}
                  <div
                    role="separator"
                    aria-label={`Resize column ${col.header}`}
                    onMouseDown={(e) => handleMouseDown(e, col)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '8px',
                      cursor: 'col-resize',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '2px',
                        height: '60%',
                        backgroundColor: 'var(--color-border)'
                      }}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const key = keyExtractor(row);
            return (
              <TableRow
                key={key}
                row={row}
                columns={initialColumns}
                columnWidths={columnWidths}
                onRowClick={onRowClick}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
