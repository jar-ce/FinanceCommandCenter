import React from 'react';
import { DashboardSection, DashboardHeaderTelemetry } from '@finance-command-center/shared-types';
import { StatusIndicator } from '../common/StatusIndicator';
import { TrendingUp, TrendingDown, DollarSign, Bell, ShieldAlert, Activity } from 'lucide-react';

interface DashboardHeaderProps {
  telemetrySection: DashboardSection<DashboardHeaderTelemetry>;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ telemetrySection }) => {
  if (telemetrySection.status === 'ERROR') {
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
        <strong>Telemetry Stream Error:</strong> {telemetrySection.errorMessage || 'Failed to load telemetry summary.'}
      </div>
    );
  }

  if (telemetrySection.status === 'UNAVAILABLE') {
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
        <strong>Telemetry Stream Unavailable:</strong> Domain telemetry data is temporarily unreachable.
      </div>
    );
  }

  const data = telemetrySection.data;

  if (telemetrySection.status === 'EMPTY' || !data) {
    return (
      <div
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--color-text-secondary)'
        }}
      >
        Telemetry metrics unavailable.
      </div>
    );
  }

  const isDailyPositive = data.dailyMarketChangePercent ? !data.dailyMarketChangePercent.startsWith('-') : null;
  const isUnrealizedPositive = !data.totalUnrealizedPnL.startsWith('-');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Top Banner Bar for System Freshness & Valuation Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Financial Command Center
          </h1>
          {data.valuationPartial && (
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                color: 'var(--color-warning)',
                border: '1px solid var(--color-warning)'
              }}
              title="Some holdings lack live market quote valuation"
            >
              VALUATION PARTIAL
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Activity size={16} color="var(--color-text-secondary)" />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Market Freshness:</span>
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
      </div>

      {/* Grid of Key Telemetry Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-3)'
        }}
      >
        {/* Total Portfolio Market Value */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Portfolio Value
            </span>
            <DollarSign size={16} color="var(--color-brand-primary)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            ₹{parseFloat(data.portfolioMarketValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {data.dailyMarketChangePercent !== null ? (
              <span style={{ color: isDailyPositive ? 'var(--color-positive)' : 'var(--color-negative)', fontWeight: 600 }}>
                {isDailyPositive ? '+' : ''}{data.dailyMarketChangePercent}% (Daily Change)
              </span>
            ) : (
              <span>Daily Change: N/A</span>
            )}
          </div>
        </div>

        {/* Total Unrealized P&L */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Unrealized P&L
            </span>
            {isUnrealizedPositive ? <TrendingUp size={16} color="var(--color-positive)" /> : <TrendingDown size={16} color="var(--color-negative)" />}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: isUnrealizedPositive ? 'var(--color-positive)' : 'var(--color-negative)'
            }}
          >
            {isUnrealizedPositive ? '+' : ''}₹{parseFloat(data.totalUnrealizedPnL).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Realized: ₹{parseFloat(data.totalRealizedPnL).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Digital Khata Balance */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Khata Cash Net
            </span>
            <ShieldAlert size={16} color="var(--color-brand-accent)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            ₹{parseFloat(data.khataNetBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Operational Ledger Cash
          </div>
        </div>

        {/* Intelligence Alerts & Unread Notifications */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Alerts & Notifications
            </span>
            <Bell size={16} color="var(--color-warning)" />
          </div>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {data.unreadNotificationsCount} Unread
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {data.activeAlertRulesCount} Active Alert Rules
          </div>
        </div>
      </div>
    </div>
  );
};
