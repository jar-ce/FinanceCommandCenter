import React, { useEffect, useState, useCallback } from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { DashboardSummaryDTO, ApiResponse } from '@finance-command-center/shared-types';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { AttentionBanner } from '../components/dashboard/AttentionBanner';
import { PortfolioSnapshot } from '../components/dashboard/PortfolioSnapshot';
import { WatchlistMatrix } from '../components/dashboard/WatchlistMatrix';
import { TopHoldingsTable } from '../components/dashboard/TopHoldingsTable';
import { IPOPipeline } from '../components/dashboard/IPOPipeline';
import { KhataSummary } from '../components/dashboard/KhataSummary';
import { ActivityStream } from '../components/dashboard/ActivityStream';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const CommandCenterPage: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/dashboard/summary', {
        headers: {
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to retrieve dashboard summary`);
      }

      const json: ApiResponse<DashboardSummaryDTO> = await response.json();
      if (json.success && json.data) {
        setSummary(json.data);
      } else {
        throw new Error('Invalid dashboard payload returned from server');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardSummary();
  }, [fetchDashboardSummary]);

  if (loading && !summary) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (error && !summary) {
    return (
      <PageContainer>
        <ErrorState
          title="Command Center Disrupted"
          message={error}
          onRetry={fetchDashboardSummary}
        />
      </PageContainer>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <PageContainer>
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-2)' }}>
        <button
          onClick={fetchDashboardSummary}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>{loading ? 'Refreshing Deck...' : 'Refresh Deck'}</span>
        </button>
      </div>

      {/* Main Command Center Deck Stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* 1. Header Telemetry Strip */}
        <DashboardHeader telemetrySection={summary.headerTelemetry} />

        {/* 2. Urgent Attention / Action Banner */}
        <AttentionBanner
          ipoSection={summary.ipoSummary}
          alertsSection={summary.alertsSummary}
          overallFreshness={summary.headerTelemetry.data?.overallFreshness}
          valuationPartial={summary.headerTelemetry.data?.valuationPartial}
        />

        {/* 3. Responsive Multi-Column Command Grid */}
        <div className="dashboard-grid">
          {/* Main Financial Core Column (Column 1 - Wide) */}
          <div className="dashboard-col-main">
            <PortfolioSnapshot portfolioSection={summary.portfolioOverview} />
            <TopHoldingsTable holdingsSection={summary.topHoldings} />
            <WatchlistMatrix watchlistSection={summary.watchlistSummary} />
          </div>

          {/* Operational Modules & Activity Stream Column (Column 2/3) */}
          <div className="dashboard-col-side">
            <IPOPipeline ipoSection={summary.ipoSummary} />
            <KhataSummary khataSection={summary.khataSummary} />
            <ActivityStream activitySection={summary.activityStream} />
          </div>
        </div>
      </div>

      {/* CSS Rules for Responsive Layout Breakpoints */}
      <style>{`
        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: var(--space-4);
        }

        .dashboard-col-main {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .dashboard-col-side {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        @media (min-width: 1400px) {
          .dashboard-grid {
            grid-template-columns: 2.2fr 1.1fr;
          }
        }

        @media (max-width: 1199px) and (min-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 767px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </PageContainer>
  );
};
