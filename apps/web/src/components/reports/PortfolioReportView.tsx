/**
 * FINANCE COMMAND CENTER (APEX OS)
 * PortfolioReportView Component (Phase 16)
 */

import React from 'react';
import { PortfolioPerformanceReportDTO, AssetAllocationReportDTO } from '@finance-command-center/shared-types';

interface PortfolioReportViewProps {
  performance: PortfolioPerformanceReportDTO | null;
  allocation: AssetAllocationReportDTO | null;
  isLoading: boolean;
}

export const PortfolioReportView: React.FC<PortfolioReportViewProps> = ({
  performance,
  allocation,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
        Loading Portfolio Performance & Allocation Report...
      </div>
    );
  }

  if (!performance) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
        No portfolio data available for the selected range.
      </div>
    );
  }

  const { currentSnapshot, periodPerformance, isMultiPortfolio } = performance;
  const isUnrealizedPos = parseFloat(currentSnapshot.unrealizedPnL) >= 0;
  const isRealizedPos = parseFloat(periodPerformance.realizedPnL) >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. CURRENT SNAPSHOT vs PERIOD PERFORMANCE SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Snapshot Card */}
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--color-surface-card, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '8px'
          }}
        >
          <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 600, marginBottom: '12px' }}>
            Current Portfolio Snapshot
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
            ₹{parseFloat(currentSnapshot.totalMarketValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
            <span>Active Acquisition Cost:</span>
            <span>₹{parseFloat(currentSnapshot.activeAcquisitionCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: '#cbd5e1' }}>Current Unrealized P&L:</span>
            <span style={{ color: isUnrealizedPos ? '#4ade80' : '#f87171', fontWeight: 600 }}>
              {isUnrealizedPos ? '+' : ''}₹{parseFloat(currentSnapshot.unrealizedPnL).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({currentSnapshot.unrealizedPnLPercent}%)
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #334155' }}>
            <span>Holdings: {currentSnapshot.holdingCount}</span>
            <span>Coverage: {currentSnapshot.valuationCoverage.coveragePercentage}% ({currentSnapshot.overallFreshness})</span>
          </div>
        </div>

        {/* Period Performance Card */}
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--color-surface-card, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '8px'
          }}
        >
          <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 600, marginBottom: '12px' }}>
            Period Performance ({periodPerformance.dateRange.preset})
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 700, color: isRealizedPos ? '#4ade80' : '#f87171' }}>
              {isRealizedPos ? '+' : ''}₹{parseFloat(periodPerformance.realizedPnL).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Realized P&L</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
            <span>Capital Deployed:</span>
            <span>₹{parseFloat(periodPerformance.totalCapitalDeployed).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
            <span>Proceeds from Sales:</span>
            <span>₹{parseFloat(periodPerformance.totalProceedsFromSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
            <span>Simple Return:</span>
            <span style={{ fontWeight: 600, color: '#38bdf8' }}>{periodPerformance.simpleReturnPercent}%</span>
          </div>
        </div>

        {/* Return Metrics Badges */}
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--color-surface-card, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '8px'
          }}
        >
          <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 600, marginBottom: '12px' }}>
            Advanced Return Metrics
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>XIRR (Extended Internal Rate of Return):</div>
            {periodPerformance.xirrStatus === 'CALCULATED' ? (
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>{periodPerformance.xirrPercent}%</span>
            ) : (
              <span style={{ fontSize: '13px', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                UNAVAILABLE {isMultiPortfolio ? '(Multi-portfolio aggregation)' : ''}
              </span>
            )}
          </div>

          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>CAGR (Compound Annual Growth Rate):</div>
            {periodPerformance.cagrStatus === 'CALCULATED' ? (
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80' }}>{periodPerformance.cagrPercent}%</span>
            ) : (
              <span style={{ fontSize: '13px', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                {periodPerformance.cagrEligibilityReason || 'UNAVAILABLE (< 1 year holding history)'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. ASSET ALLOCATION BREAKDOWN */}
      {allocation && allocation.breakdownBySecurityType.length > 0 && (
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--color-surface-card, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '8px'
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
            Asset Class Allocation Breakdown
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allocation.breakdownBySecurityType.map((item) => (
              <div key={item.securityType}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.securityType} ({item.holdingCount} holdings)</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                    ₹{parseFloat(item.marketValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({item.allocationPercent}%)
                  </span>
                </div>
                {/* SVG/CSS Progress Bar */}
                <div style={{ height: '8px', width: '100%', backgroundColor: '#0f172a', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(0, parseFloat(item.allocationPercent)))}%`,
                      backgroundColor: 'var(--color-brand-primary, #38bdf8)',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. HOLDINGS ALLOCATION TABLE */}
      {allocation && allocation.holdings.length > 0 && (
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--color-surface-card, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '8px'
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
            Holdings Allocation & Valuation
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '8px 12px' }}>Instrument</th>
                  <th style={{ padding: '8px 12px' }}>Asset Class</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantity</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Current Price</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Market Value</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Weight %</th>
                </tr>
              </thead>
              <tbody>
                {allocation.holdings.map((h) => (
                  <tr key={h.instrumentId} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#ffffff' }}>
                      {h.symbol} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>({h.exchange})</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{h.securityType}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#cbd5e1' }}>{h.quantity}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#cbd5e1' }}>
                      {h.currentPrice ? `₹${parseFloat(h.currentPrice).toFixed(2)}` : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#ffffff' }}>
                      {h.marketValue ? `₹${parseFloat(h.marketValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#38bdf8', fontWeight: 600 }}>
                      {h.allocationPercent ? `${h.allocationPercent}%` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
