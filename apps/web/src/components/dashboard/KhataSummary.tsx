import React from 'react';
import { DashboardSection, DashboardKhataOverview } from '@finance-command-center/shared-types';
import { BookOpen, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface KhataSummaryProps {
  khataSection: DashboardSection<DashboardKhataOverview>;
}

export const KhataSummary: React.FC<KhataSummaryProps> = ({ khataSection }) => {
  if (khataSection.status === 'ERROR') {
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
        <strong>Khata Ledger Error:</strong> {khataSection.errorMessage || 'Failed to load Digital Khata ledger.'}
      </div>
    );
  }

  if (khataSection.status === 'UNAVAILABLE') {
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
        <strong>Khata Ledger Unavailable:</strong> Digital Khata service is down.
      </div>
    );
  }

  const data = khataSection.data;

  if (khataSection.status === 'EMPTY' || !data || data.activeAccountsCount === 0) {
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
        No active Khata ledger accounts found.
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
          <BookOpen size={20} color="var(--color-brand-primary)" />
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0 }}>
            Digital Khata Summary
          </h2>
        </div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {data.activeAccountsCount} Active Account(s)
        </span>
      </div>

      {/* Net Balance & Cash Flow Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-2)',
          backgroundColor: 'var(--color-bg-elevated)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Net Cash Balance</div>
          <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            ₹{parseFloat(data.totalNetBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-positive)' }}>Receivable (+)</div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-positive)' }}>
            ₹{parseFloat(data.totalReceivable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-negative)' }}>Payable (-)</div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-negative)' }}>
            ₹{parseFloat(data.totalPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Recent Ledger Activity */}
      {data.recentTransactions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Recent Ledger Activity
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {data.recentTransactions.map((tx) => {
              const isMoneyIn = tx.type === 'MONEY_IN';
              return (
                <div
                  key={tx.id}
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
                    {isMoneyIn ? (
                      <ArrowDownLeft size={16} color="var(--color-positive)" />
                    ) : (
                      <ArrowUpRight size={16} color="var(--color-negative)" />
                    )}
                    <div>
                      <strong>{tx.accountName}</strong>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>{tx.description}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ color: isMoneyIn ? 'var(--color-positive)' : 'var(--color-negative)', fontWeight: 600 }}>
                      {isMoneyIn ? '+' : '-'}₹{parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                      Bal: ₹{parseFloat(tx.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
