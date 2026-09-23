import React from 'react';
import { DashboardSection, DashboardIPOItem, IPOApplicationRecord } from '@finance-command-center/shared-types';
import { Rocket, Clock, FileText } from 'lucide-react';

interface IPOPipelineProps {
  ipoSection: DashboardSection<{
    activeIpos: DashboardIPOItem[];
    userApplications: IPOApplicationRecord[];
  }>;
}

export const IPOPipeline: React.FC<IPOPipelineProps> = ({ ipoSection }) => {
  if (ipoSection.status === 'ERROR') {
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
        <strong>IPO Pipeline Error:</strong> {ipoSection.errorMessage || 'Failed to load IPO data.'}
      </div>
    );
  }

  if (ipoSection.status === 'UNAVAILABLE') {
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
        <strong>IPO Pipeline Unavailable:</strong> IPO data service is unreachable.
      </div>
    );
  }

  const activeIpos = ipoSection.data?.activeIpos || [];
  const applications = ipoSection.data?.userApplications || [];

  if (ipoSection.status === 'EMPTY' || (activeIpos.length === 0 && applications.length === 0)) {
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
        No active IPOs or applications currently tracked.
      </div>
    );
  }

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
          <Rocket size={20} color="var(--color-brand-primary)" />
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0 }}>
            IPO Pipeline & Applications
          </h2>
        </div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {activeIpos.length} Active IPO(s)
        </span>
      </div>

      {/* Active IPO Catalog Cards */}
      {activeIpos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Open / Upcoming Issues
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-2)' }}>
            {activeIpos.map((ipo) => (
              <div
                key={ipo.id}
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: ipo.closingSoon ? '1px solid var(--color-warning)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{ipo.ipoName}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{ipo.issuerName}</div>
                  </div>
                  {ipo.closingSoon && (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(234, 179, 8, 0.15)',
                        color: 'var(--color-warning)',
                        border: '1px solid var(--color-warning)'
                      }}
                    >
                      <Clock size={10} /> CLOSING SOON
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    Price Band: {ipo.priceBandLow && ipo.priceBandHigh ? `₹${ipo.priceBandLow} - ₹${ipo.priceBandHigh}` : 'TBD'}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-brand-accent)' }}>{ipo.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Application Tracker Summary */}
      {applications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            My Active Applications ({applications.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {applications.map((app) => (
              <div
                key={app.id}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 'var(--font-size-xs)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <FileText size={14} color="var(--color-brand-primary)" />
                  <div>
                    <strong>{app.ipoName || 'IPO Issue'}</strong>
                    <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>
                      ({app.lotsApplied} Lot{app.lotsApplied > 1 ? 's' : ''})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-mono)' }}>
                  <span>₹{parseFloat(app.applicationAmount).toLocaleString('en-IN')}</span>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      fontWeight: 600,
                      color: app.status === 'COMPLETED' ? 'var(--color-positive)' : 'var(--color-brand-accent)'
                    }}
                  >
                    {app.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
