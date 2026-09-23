/**
 * FINANCE COMMAND CENTER (APEX OS)
 * KhataReportView Component (Phase 16)
 */

import React from 'react';
import { KhataCashFlowReportDTO } from '@finance-command-center/shared-types';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface KhataReportViewProps {
  report: KhataCashFlowReportDTO | null;
  isLoading: boolean;
  onPageChange?: (page: number) => void;
}

export const KhataReportView: React.FC<KhataReportViewProps> = ({ report, isLoading, onPageChange: _onPageChange }) => {
  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading Khata Cash Flow Report...</div>;
  }

  if (!report) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No Digital Khata data available.</div>;
  }

  const isNetPos = parseFloat(report.netCashMovement) >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. CASH FLOW SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
            <ArrowDownRight size={16} color="#4ade80" />
            Total Inflow (Period)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#4ade80' }}>
            ₹{parseFloat(report.totalInflow).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
            <ArrowUpRight size={16} color="#f87171" />
            Total Outflow (Period)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f87171' }}>
            ₹{parseFloat(report.totalOutflow).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Net Cash Movement</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: isNetPos ? '#4ade80' : '#f87171' }}>
            {isNetPos ? '+' : ''}₹{parseFloat(report.netCashMovement).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Total Ledger Balance</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
            ₹{parseFloat(report.netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            <span style={{ color: '#4ade80' }}>Rec: ₹{parseFloat(report.totalReceivable).toFixed(0)}</span>
            <span style={{ color: '#f87171' }}>Pay: ₹{parseFloat(report.totalPayable).toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* 2. ACCOUNT CASH FLOW SUMMARIES */}
      {report.accountSummaries.length > 0 && (
        <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
            Khata Account Activity Summaries
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '8px 12px' }}>Account</th>
                  <th style={{ padding: '8px 12px' }}>Party Name</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Inflow</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Outflow</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Net Movement</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Current Balance</th>
                </tr>
              </thead>
              <tbody>
                {report.accountSummaries.map((acc) => (
                  <tr key={acc.accountId} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#ffffff' }}>{acc.accountName}</td>
                    <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{acc.partyName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#4ade80' }}>
                      ₹{parseFloat(acc.totalInflow).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#f87171' }}>
                      ₹{parseFloat(acc.totalOutflow).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: parseFloat(acc.netMovement) >= 0 ? '#4ade80' : '#f87171' }}>
                      ₹{parseFloat(acc.netMovement).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#ffffff' }}>
                      ₹{parseFloat(acc.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TRANSACTION LOG TABLE */}
      <div style={{ padding: '20px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
          Filtered Cash Flow Transactions ({report.transactions.total})
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '8px 12px' }}>Date</th>
                <th style={{ padding: '8px 12px' }}>Account</th>
                <th style={{ padding: '8px 12px' }}>Type</th>
                <th style={{ padding: '8px 12px' }}>Description</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {report.transactions.items.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #0f172a' }}>
                  <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                    {new Date(tx.transactionDate).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 500, color: '#ffffff' }}>{tx.accountName}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: tx.type === 'MONEY_IN' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                        color: tx.type === 'MONEY_IN' ? '#4ade80' : '#f87171'
                      }}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{tx.description}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: tx.type === 'MONEY_IN' ? '#4ade80' : '#f87171' }}>
                    ₹{parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>
                    ₹{parseFloat(tx.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
