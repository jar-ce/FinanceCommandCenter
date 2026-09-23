/**
 * FINANCE COMMAND CENTER (APEX OS)
 * IPOReportView Component (Phase 16)
 */

import React from 'react';
import { IPOParticipationReportDTO } from '@finance-command-center/shared-types';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface IPOReportViewProps {
  report: IPOParticipationReportDTO | null;
  isLoading: boolean;
}

export const IPOReportView: React.FC<IPOReportViewProps> = ({ report, isLoading }) => {
  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading IPO Participation Report...</div>;
  }

  if (!report) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No IPO participation data available.</div>;
  }

  const { allotmentStats } = report;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. IPO SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Total Applications</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>{report.totalApplicationsCount}</div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Capital Committed</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#38bdf8' }}>
            ₹{parseFloat(report.totalCapitalCommitted).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Allotment Success Rate</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: allotmentStats.allotmentSuccessRatePercent ? '#4ade80' : '#f59e0b' }}>
            {allotmentStats.allotmentSuccessRatePercent ? `${allotmentStats.allotmentSuccessRatePercent}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Verified outcomes: {allotmentStats.totalVerifiedOutcomeCount}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Active Market Issues</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>{report.activeIssuesCount}</div>
        </div>
      </div>

      {/* 2. ALLOTMENT STATISTICS BREAKDOWN */}
      <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
          Allotment Outcomes & Verification Audit
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px', textAlign: 'center' }}>
            <CheckCircle2 size={20} color="#4ade80" style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{allotmentStats.allottedCount}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Allotted</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px', textAlign: 'center' }}>
            <CheckCircle2 size={20} color="#38bdf8" style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{allotmentStats.partiallyAllottedCount}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Partially Allotted</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px', textAlign: 'center' }}>
            <XCircle size={20} color="#f87171" style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{allotmentStats.notAllottedCount}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Not Allotted</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px', textAlign: 'center' }}>
            <AlertCircle size={20} color="#f59e0b" style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{allotmentStats.unverifiedCount}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Unverified</div>
          </div>
        </div>
      </div>

      {/* 3. APPLICATIONS HISTORY TABLE */}
      <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
          Application Log
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '8px 12px' }}>Application Date</th>
                <th style={{ padding: '8px 12px' }}>IPO Name</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Lots</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.applications.map((app) => (
                <tr key={app.id} style={{ borderBottom: '1px solid #0f172a' }}>
                  <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                    {new Date(app.applicationDate).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#ffffff' }}>
                    {app.ipoName || 'IPO Application'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#cbd5e1' }}>{app.lotsApplied}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#cbd5e1' }}>{app.quantityApplied}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                    ₹{parseFloat(app.applicationAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: '#0f172a', color: '#94a3b8' }}>
                      {app.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
