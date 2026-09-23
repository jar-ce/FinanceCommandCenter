/**
 * FINANCE COMMAND CENTER (APEX OS)
 * ReportsPage — Financial Command Center Reports & Analytics View (Phase 16)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { ReportHeader, ReportTab } from '../components/reports/ReportHeader';
import { DateRangePicker } from '../components/reports/DateRangePicker';
import { PortfolioReportView } from '../components/reports/PortfolioReportView';
import { KhataReportView } from '../components/reports/KhataReportView';
import { IPOReportView } from '../components/reports/IPOReportView';
import { AlertsAnalyticsView } from '../components/reports/AlertsAnalyticsView';
import {
  DateRangeFilter,
  ReportSummaryDTO,
  PortfolioPerformanceReportDTO,
  AssetAllocationReportDTO,
  RealizedPnLRecord,
  KhataCashFlowReportDTO,
  IPOParticipationReportDTO,
  AlertsAnalyticsReportDTO,
  PaginatedResponse
} from '@finance-command-center/shared-types';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ReportsPage: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({ preset: 'ALL_TIME', timezone: 'Asia/Kolkata' });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [summaryData, setSummaryData] = useState<ReportSummaryDTO | null>(null);
  const [performanceData, setPerformanceData] = useState<PortfolioPerformanceReportDTO | null>(null);
  const [allocationData, setAllocationData] = useState<AssetAllocationReportDTO | null>(null);
  const [realizedPnLData, setRealizedPnLData] = useState<PaginatedResponse<RealizedPnLRecord> | null>(null);
  const [khataData, setKhataData] = useState<KhataCashFlowReportDTO | null>(null);
  const [ipoData, setIpoData] = useState<IPOParticipationReportDTO | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsAnalyticsReportDTO | null>(null);

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    };
  };

  const buildQueryParams = (extraParams?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (dateFilter.preset) params.append('preset', dateFilter.preset);
    if (dateFilter.fromDate) params.append('fromDate', dateFilter.fromDate);
    if (dateFilter.toDate) params.append('toDate', dateFilter.toDate);
    if (dateFilter.timezone) params.append('timezone', dateFilter.timezone);

    if (extraParams) {
      Object.entries(extraParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, String(v));
      });
    }
    return params.toString();
  };

  const fetchReportData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const headers = getHeaders();
      const qStr = buildQueryParams();

      if (activeTab === 'summary') {
        const res = await fetch(`/api/v1/reports/summary?${qStr}`, { headers });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setSummaryData(json.data);
      } else if (activeTab === 'portfolio' || activeTab === 'asset-allocation') {
        const [perfRes, allocRes] = await Promise.all([
          fetch(`/api/v1/reports/portfolio-performance?${qStr}`, { headers }),
          fetch(`/api/v1/reports/asset-allocation?${qStr}`, { headers })
        ]);
        if (!perfRes.ok || !allocRes.ok) throw new Error('Failed to fetch portfolio performance or allocation');
        const perfJson = await perfRes.json();
        const allocJson = await allocRes.json();
        setPerformanceData(perfJson.data);
        setAllocationData(allocJson.data);
      } else if (activeTab === 'realized-pnl') {
        const res = await fetch(`/api/v1/reports/realized-pnl?${buildQueryParams({ page: 1, limit: 50 })}`, { headers });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setRealizedPnLData(json.data);
      } else if (activeTab === 'khata') {
        const res = await fetch(`/api/v1/reports/khata-cashflow?${qStr}`, { headers });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setKhataData(json.data);
      } else if (activeTab === 'ipo') {
        const res = await fetch(`/api/v1/reports/ipo-participation?${qStr}`, { headers });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setIpoData(json.data);
      } else if (activeTab === 'alerts') {
        const res = await fetch(`/api/v1/reports/alerts-analytics?${qStr}`, { headers });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setAlertsData(json.data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to Reports API.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, dateFilter]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  return (
    <PageContainer>
      <ReportHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={fetchReportData}
        isLoading={isLoading}
        generatedAt={summaryData?.generatedAt || performanceData?.generatedAt || new Date().toISOString()}
      />

      <DateRangePicker filter={dateFilter} onChange={setDateFilter} />

      {errorMessage && (
        <div style={{ padding: '16px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid #f87171', borderRadius: '8px', color: '#f87171', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={20} />
          <span>Error loading report: {errorMessage}</span>
        </div>
      )}

      {/* 1. EXECUTIVE SUMMARY TAB */}
      {activeTab === 'summary' && summaryData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Total Portfolio Valuation</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff' }}>
                ₹{parseFloat(summaryData.totalMarketValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '12px', color: parseFloat(summaryData.unrealizedPnL) >= 0 ? '#4ade80' : '#f87171', marginTop: '4px' }}>
                Unrealized: {parseFloat(summaryData.unrealizedPnL) >= 0 ? '+' : ''}₹{parseFloat(summaryData.unrealizedPnL).toFixed(2)} ({summaryData.unrealizedPnLPercent}%)
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Digital Khata Net Balance</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#38bdf8' }}>
                ₹{parseFloat(summaryData.khataNetBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Receivables: ₹{parseFloat(summaryData.khataReceivable).toFixed(0)} | Payables: ₹{parseFloat(summaryData.khataPayable).toFixed(0)}
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Active IPO Applications</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff' }}>
                {summaryData.activeIpoApplicationsCount}
              </div>
              <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '4px' }}>
                Allotment Success Rate: {summaryData.allotmentSuccessRatePercent ? `${summaryData.allotmentSuccessRatePercent}%` : 'N/A'}
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Alerts & Intelligence</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff' }}>
                {summaryData.activeAlertRulesCount} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 400 }}>Rules</span>
              </div>
              <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>
                Unread Notifications: {summaryData.unreadNotificationsCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PORTFOLIO & ASSET ALLOCATION TABS */}
      {(activeTab === 'portfolio' || activeTab === 'asset-allocation') && (
        <PortfolioReportView performance={performanceData} allocation={allocationData} isLoading={isLoading} />
      )}

      {/* 3. REALIZED P&L TAB */}
      {activeTab === 'realized-pnl' && (
        <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
            Realized P&L Transaction Log
          </h3>
          {realizedPnLData && realizedPnLData.items.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px' }}>Instrument</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sold Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sale Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Gross Proceeds</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Cost Removed</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {realizedPnLData.items.map((r) => {
                    const isPos = parseFloat(r.realizedPnL) >= 0;
                    return (
                      <tr key={r.transactionId} style={{ borderBottom: '1px solid #0f172a' }}>
                        <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{new Date(r.transactionDate).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#ffffff' }}>{r.symbol}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#cbd5e1' }}>{r.soldQuantity}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#cbd5e1' }}>₹{parseFloat(r.price).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#cbd5e1' }}>₹{parseFloat(r.grossProceeds).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#cbd5e1' }}>₹{parseFloat(r.costRemoved).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: isPos ? '#4ade80' : '#f87171' }}>
                          {isPos ? '+' : ''}₹{parseFloat(r.realizedPnL).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#64748b' }}>No realized P&L records found in this period.</div>
          )}
        </div>
      )}

      {/* 4. DIGITAL KHATA TAB */}
      {activeTab === 'khata' && <KhataReportView report={khataData} isLoading={isLoading} />}

      {/* 5. IPO TAB */}
      {activeTab === 'ipo' && <IPOReportView report={ipoData} isLoading={isLoading} />}

      {/* 6. ALERTS TAB */}
      {activeTab === 'alerts' && <AlertsAnalyticsView report={alertsData} isLoading={isLoading} />}
    </PageContainer>
  );
};
