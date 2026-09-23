/**
 * FINANCE COMMAND CENTER (APEX OS)
 * AlertsAnalyticsView Component (Phase 16)
 */

import React from 'react';
import { AlertsAnalyticsReportDTO } from '@finance-command-center/shared-types';
import { Bell, ShieldCheck, PauseCircle, Activity } from 'lucide-react';

interface AlertsAnalyticsViewProps {
  report: AlertsAnalyticsReportDTO | null;
  isLoading: boolean;
}

export const AlertsAnalyticsView: React.FC<AlertsAnalyticsViewProps> = ({ report, isLoading }) => {
  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading Alerts & Intelligence Analytics...</div>;
  }

  if (!report) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No Alert Analytics data available.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. RULE & NOTIFICATION METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>
            <ShieldCheck size={16} color="#4ade80" />
            Active Alert Rules
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#4ade80' }}>{report.activeRulesCount}</div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>
            <PauseCircle size={16} color="#f59e0b" />
            Paused Rules
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>{report.pausedRulesCount}</div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>
            <Activity size={16} color="#38bdf8" />
            Triggers (Period)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#38bdf8' }}>{report.totalTriggersInPeriod}</div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>
            <Bell size={16} color="#f43f5e" />
            Unread Notifications
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>{report.unreadNotificationsCount}</div>
        </div>
      </div>

      {/* 2. RULE DISTRIBUTION BY ALERT TYPE */}
      {report.rulesByType.length > 0 && (
        <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
            Rule Distribution by Alert Condition Type
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {report.rulesByType.map((item) => (
              <div key={item.alertType}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{item.alertType}</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>{item.count} rules</span>
                </div>
                <div style={{ height: '6px', width: '100%', backgroundColor: '#0f172a', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(5, (item.count / report.totalRulesCount) * 100))}%`,
                      backgroundColor: '#38bdf8',
                      borderRadius: '3px'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. RECENT NOTIFICATIONS TIMELINE */}
      <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
          Recent Notification Events
        </h3>

        {report.recentNotifications.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#64748b' }}>No trigger notifications in this period.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report.recentNotifications.map((n) => (
              <div key={n.id} style={{ padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px', borderLeft: n.status === 'UNREAD' ? '3px solid #38bdf8' : '3px solid #475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                  <span>{n.title}</span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>
                    {new Date(n.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>{n.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
