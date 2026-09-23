/**
 * FINANCE COMMAND CENTER (APEX OS)
 * ReportHeader Component (Phase 16)
 */

import React from 'react';
import { FileText, PieChart, DollarSign, Wallet, Target, Bell, RefreshCw } from 'lucide-react';

export type ReportTab = 'summary' | 'portfolio' | 'asset-allocation' | 'realized-pnl' | 'khata' | 'ipo' | 'alerts';

interface ReportHeaderProps {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  onRefresh: () => void;
  isLoading: boolean;
  generatedAt?: string;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  activeTab,
  onTabChange,
  onRefresh,
  isLoading,
  generatedAt
}) => {
  const tabs: Array<{ id: ReportTab; label: string; icon: React.ReactNode }> = [
    { id: 'summary', label: 'Executive Summary', icon: <FileText size={16} /> },
    { id: 'portfolio', label: 'Portfolio Performance', icon: <PieChart size={16} /> },
    { id: 'asset-allocation', label: 'Asset Allocation', icon: <PieChart size={16} /> },
    { id: 'realized-pnl', label: 'Realized P&L', icon: <DollarSign size={16} /> },
    { id: 'khata', label: 'Digital Khata', icon: <Wallet size={16} /> },
    { id: 'ipo', label: 'IPO Participation', icon: <Target size={16} /> },
    { id: 'alerts', label: 'Alerts Analytics', icon: <Bell size={16} /> }
  ];

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary, #ffffff)' }}>
            Financial Reports & Analytics
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--color-text-secondary, #94a3b8)' }}>
            Canonical Period-Based Projections & Multi-Asset Intelligence
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {generatedAt && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Updated: {new Date(generatedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: 'var(--color-surface-card, #1e293b)',
              color: 'var(--color-text-primary, #ffffff)',
              border: '1px solid var(--color-border, #334155)',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Report Tab Navigation Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border, #334155)', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--color-brand-primary, #38bdf8)' : 'var(--color-text-secondary, #94a3b8)',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-brand-primary, #38bdf8)' : '2px solid transparent',
                fontWeight: isActive ? 600 : 400,
                fontSize: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
