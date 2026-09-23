import React from 'react';
import { DashboardSection, DashboardIPOItem, NotificationRecord, MarketDataFreshness } from '@finance-command-center/shared-types';
import { AlertTriangle, Clock, Bell, Info } from 'lucide-react';

interface AttentionBannerProps {
  ipoSection: DashboardSection<{ activeIpos: DashboardIPOItem[] }>;
  alertsSection: DashboardSection<{ unreadCount: number; recentNotifications: NotificationRecord[] }>;
  overallFreshness?: MarketDataFreshness;
  valuationPartial?: boolean;
}

export const AttentionBanner: React.FC<AttentionBannerProps> = ({
  ipoSection,
  alertsSection,
  overallFreshness,
  valuationPartial
}) => {
  const closingSoonIpos = ipoSection.data?.activeIpos?.filter((ipo) => ipo.closingSoon) || [];
  const unreadCount = alertsSection.data?.unreadCount || 0;

  const hasClosingIpos = closingSoonIpos.length > 0;
  const hasUnreadNotifications = unreadCount > 0;
  const isMarketDegraded = overallFreshness === 'STALE' || overallFreshness === 'UNAVAILABLE';
  const isValuationPartial = Boolean(valuationPartial);

  if (!hasClosingIpos && !hasUnreadNotifications && !isMarketDegraded && !isValuationPartial) {
    return null; // Nothing urgent to bring to user's attention
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'rgba(234, 179, 8, 0.08)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-warning)' }}>
        <AlertTriangle size={18} />
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Action Required / System Attention
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 'var(--font-size-sm)' }}>
        {hasClosingIpos && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
            <Clock size={14} color="var(--color-warning)" />
            <span>
              <strong>IPO Closing Window:</strong> {closingSoonIpos.length} IPO(s) closing within 24 hours (
              {closingSoonIpos.map((i) => i.ipoName).join(', ')})
            </span>
          </div>
        )}

        {hasUnreadNotifications && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
            <Bell size={14} color="var(--color-brand-primary)" />
            <span>
              <strong>Unread Alerts:</strong> You have {unreadCount} unread notification(s) requiring review.
            </span>
          </div>
        )}

        {isValuationPartial && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
            <Info size={14} color="var(--color-warning)" />
            <span>
              <strong>Valuation Partial:</strong> One or more holdings lack live quotes. Portfolio valuation uses acquisition cost as fallback.
            </span>
          </div>
        )}

        {isMarketDegraded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
            <AlertTriangle size={14} color="var(--color-negative)" />
            <span>
              <strong>Market Feed Degraded:</strong> Market quote status is currently <strong>{overallFreshness}</strong>. Prices may be delayed or unavailable.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
