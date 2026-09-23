import React from 'react';
import { DashboardSection, DashboardHoldingItem } from '@finance-command-center/shared-types';
import { ResizableTable, ColumnDef } from '../common/ResizableTable';
import { Layers } from 'lucide-react';

interface TopHoldingsTableProps {
  holdingsSection: DashboardSection<DashboardHoldingItem[]>;
}

export const TopHoldingsTable: React.FC<TopHoldingsTableProps> = ({ holdingsSection }) => {
  if (holdingsSection.status === 'ERROR') {
    return (
      <div
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-negative)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--color-negative)'
        }}
      >
        <strong>Top Holdings Error:</strong> {holdingsSection.errorMessage || 'Failed to load holdings.'}
      </div>
    );
  }

  if (holdingsSection.status === 'UNAVAILABLE') {
    return (
      <div
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-warning)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--color-warning)'
        }}
      >
        <strong>Top Holdings Unavailable:</strong> Holding valuation data service is down.
      </div>
    );
  }

  const holdings = holdingsSection.data || [];

  if (holdingsSection.status === 'EMPTY' || holdings.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--color-text-secondary)',
          textAlign: 'center'
        }}
      >
        No active holdings across portfolios.
      </div>
    );
  }

  const columns: ColumnDef<DashboardHoldingItem>[] = [
    {
      id: 'symbol',
      header: 'Instrument',
      accessor: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.symbol}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{row.displayName}</div>
        </div>
      ),
      width: 180
    },
    {
      id: 'quantity',
      header: 'Quantity / Avg Cost',
      accessor: (row) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>
          <div>{parseFloat(row.quantity).toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Avg ₹{parseFloat(row.averageCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      ),
      width: 160
    },
    {
      id: 'currentPrice',
      header: 'Market Price',
      accessor: (row) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>
          {row.currentPrice ? (
            <div>₹{parseFloat(row.currentPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          ) : (
            <div style={{ color: 'var(--color-warning)', fontSize: 'var(--font-size-xs)' }}>N/A (Cost Used)</div>
          )}
          {row.dailyMarketChangePercent !== null && (
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: row.dailyMarketChangePercent.startsWith('-') ? 'var(--color-negative)' : 'var(--color-positive)',
                fontWeight: 600
              }}
            >
              {row.dailyMarketChangePercent.startsWith('-') ? '' : '+'}{row.dailyMarketChangePercent}%
            </div>
          )}
        </div>
      ),
      width: 150
    },
    {
      id: 'marketValue',
      header: 'Market Value',
      accessor: (row) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          ₹{parseFloat(row.marketValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      ),
      width: 160
    },
    {
      id: 'unrealizedPnL',
      header: 'Unrealized P&L',
      accessor: (row) => {
        const isPositive = !row.unrealizedPnL.startsWith('-');
        return (
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            <div style={{ color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)', fontWeight: 600 }}>
              {isPositive ? '+' : ''}₹{parseFloat(row.unrealizedPnL).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)' }}>
              {isPositive ? '+' : ''}{row.unrealizedPnLPercent}%
            </div>
          </div>
        );
      },
      width: 160
    }
  ];

  return (
    <div
      style={{
        padding: 'var(--space-4)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Layers size={20} color="var(--color-brand-accent)" />
        <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0 }}>
          Top Holdings Breakdown
        </h2>
      </div>

      <ResizableTable
        columns={columns}
        data={holdings}
        keyExtractor={(row) => row.instrumentId}
      />
    </div>
  );
};
