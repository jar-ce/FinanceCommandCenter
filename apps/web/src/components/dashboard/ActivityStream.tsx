import React from 'react';
import { DashboardSection, UnifiedActivityItem } from '@finance-command-center/shared-types';
import { Activity, BookOpen, PieChart, Rocket, Bell } from 'lucide-react';

interface ActivityStreamProps {
  activitySection: DashboardSection<UnifiedActivityItem[]>;
}

export const ActivityStream: React.FC<ActivityStreamProps> = ({ activitySection }) => {
  if (activitySection.status === 'ERROR') {
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
        <strong>Activity Timeline Error:</strong> {activitySection.errorMessage || 'Failed to load timeline.'}
      </div>
    );
  }

  if (activitySection.status === 'UNAVAILABLE') {
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
        <strong>Activity Stream Unavailable:</strong> Operational activity stream service is down.
      </div>
    );
  }

  const activities = activitySection.data || [];

  if (activitySection.status === 'EMPTY' || activities.length === 0) {
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
        No recent operational activity recorded across subsystems.
      </div>
    );
  }

  const getCategoryIcon = (category: UnifiedActivityItem['category']) => {
    switch (category) {
      case 'KHATA':
        return <BookOpen size={14} color="var(--color-brand-primary)" />;
      case 'PORTFOLIO':
        return <PieChart size={14} color="var(--color-positive)" />;
      case 'IPO':
        return <Rocket size={14} color="var(--color-brand-accent)" />;
      case 'NOTIFICATION':
        return <Bell size={14} color="var(--color-warning)" />;
      default:
        return <Activity size={14} color="var(--color-text-secondary)" />;
    }
  };

  const getCategoryBadgeStyle = (category: UnifiedActivityItem['category']) => {
    switch (category) {
      case 'KHATA':
        return { color: 'var(--color-brand-primary)', border: '1px solid var(--color-brand-primary)', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'PORTFOLIO':
        return { color: 'var(--color-positive)', border: '1px solid var(--color-positive)', bg: 'rgba(34, 197, 94, 0.1)' };
      case 'IPO':
        return { color: 'var(--color-brand-accent)', border: '1px solid var(--color-brand-accent)', bg: 'rgba(168, 85, 247, 0.1)' };
      case 'NOTIFICATION':
        return { color: 'var(--color-warning)', border: '1px solid var(--color-warning)', bg: 'rgba(234, 179, 8, 0.1)' };
    }
  };

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
          <Activity size={20} color="var(--color-brand-primary)" />
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0 }}>
            Unified Activity Stream
          </h2>
        </div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          Real Domain Events
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {activities.map((item) => {
          const badgeStyle = getCategoryBadgeStyle(item.category);
          const formattedTime = new Date(item.timestamp).toLocaleString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          return (
            <div
              key={item.id}
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {getCategoryIcon(item.category)}
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{item.title}</span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: badgeStyle.bg,
                    color: badgeStyle.color,
                    border: badgeStyle.border
                  }}
                >
                  {item.category}
                </span>
              </div>

              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {item.description}
              </div>

              <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                {formattedTime}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
