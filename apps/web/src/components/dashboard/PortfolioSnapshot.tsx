import React from 'react';
import { DashboardSection, DashboardPortfolioOverview } from '@finance-command-center/shared-types';
import { PieChart, Layers, HelpCircle } from 'lucide-react';
import { StatusIndicator } from '../common/StatusIndicator';

interface PortfolioSnapshotProps {
  portfolioSection: DashboardSection<DashboardPortfolioOverview>;
}

export const PortfolioSnapshot: React.FC<PortfolioSnapshotProps> = ({ portfolioSection }) => {
  if (portfolioSection.status === 'ERROR') {
    return (
      <div
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-negative)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div style={{ color: 'var(--color-negative)', fontWeight: 600 }}>Portfolio Subsystem Failure</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          {portfolioSection.errorMessage || 'Unable to retrieve portfolio summary metrics.'}
        </div>
      </div>
    );
  }

  if (portfolioSection.status === 'UNAVAILABLE') {
    return (
      <div
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-warning)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Portfolio Data Unavailable</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          Portfolio database service is unreachable.
        </div>
      </div>
    );
  }

  const data = portfolioSection.data;

  if (portfolioSection.status === 'EMPTY' || !data || data.portfolioCount === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center'
        }}
      >
        <PieChart size={32} color="var(--color-text-secondary)" style={{ marginBottom: 'var(--space-2)' }} />
        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>No Portfolios Found</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          Create a portfolio in the Portfolio & Holdings module to track investments.
        </div>
      </div>
    );
  }

  const isUnrealizedPositive = !data.unrealizedPnL.startsWith('-');
  const isTotalPositive = !data.totalPnL.startsWith('-');

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <PieChart size={20} color="var(--color-brand-primary)" />
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0 }}>
            Portfolio Snapshot
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)'
            }}
          >
            {data.portfolioCount} Portfolio{data.portfolioCount > 1 ? 's' : ''}
          </span>
          <StatusIndicator
            status={
              data.overallFreshness === 'LIVE'
                ? 'online'
                : data.overallFreshness === 'DELAYED' || data.overallFreshness === 'EOD'
                ? 'warning'
                : 'offline'
            }
            label={data.overallFreshness}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-3)',
          backgroundColor: 'var(--color-bg-elevated)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Total Market Value</div>
          <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            ₹{parseFloat(data.totalMarketValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Total Acquisition Cost</div>
          <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            ₹{parseFloat(data.totalAcquisitionCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Unrealized P&L</div>
          <div
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: isUnrealizedPositive ? 'var(--color-positive)' : 'var(--color-negative)'
            }}
          >
            {isUnrealizedPositive ? '+' : ''}₹{parseFloat(data.unrealizedPnL).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({data.unrealizedPnLPercent}%)
          </div>
        </div>

        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Total P&L (Realized + Unrealized)</div>
          <div
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: isTotalPositive ? 'var(--color-positive)' : 'var(--color-negative)'
            }}
          >
            {isTotalPositive ? '+' : ''}₹{parseFloat(data.totalPnL).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Return Performance & Valuation Coverage */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          fontSize: 'var(--font-size-xs)',
          paddingTop: 'var(--space-1)'
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Simple Return: </span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>
              {data.simpleReturnPercent !== null ? `${data.simpleReturnPercent}%` : 'N/A'}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>XIRR: </span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>
              {data.xirrStatus === 'CALCULATED' && data.xirrPercent !== null
                ? `${data.xirrPercent}%`
                : 'UNAVAILABLE (Multi-Portfolio)'}
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--color-text-secondary)' }}>
          <Layers size={14} />
          <span>Valuation Coverage: <strong>{data.valuationCoveragePercentage}%</strong></span>
          {data.valuationPartial && (
            <span title="Some holdings lack live price quotes">
              <HelpCircle size={14} color="var(--color-warning)" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
