import React from 'react';
import { DashboardSection, DashboardWatchlistItem } from '@finance-command-center/shared-types';
import { Eye, TrendingUp, TrendingDown } from 'lucide-react';

interface WatchlistMatrixProps {
  watchlistSection: DashboardSection<DashboardWatchlistItem[]>;
}

export const WatchlistMatrix: React.FC<WatchlistMatrixProps> = ({ watchlistSection }) => {
  if (watchlistSection.status === 'ERROR') {
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
        <strong>Watchlist Stream Error:</strong> {watchlistSection.errorMessage || 'Failed to load watchlist items.'}
      </div>
    );
  }

  if (watchlistSection.status === 'UNAVAILABLE') {
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
        <strong>Watchlist Service Unavailable:</strong> Watchlist market quotes feed is down.
      </div>
    );
  }

  const items = watchlistSection.data || [];

  if (watchlistSection.status === 'EMPTY' || items.length === 0) {
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
        No instruments in active watchlists.
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
          <Eye size={20} color="var(--color-brand-primary)" />
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0 }}>
            Watchlist Pulse
          </h2>
        </div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {items.length} Tracked Asset{items.length > 1 ? 's' : ''}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-3)'
        }}
      >
        {items.map((item) => {
          const isPositive = item.dailyMarketChangePercent ? !item.dailyMarketChangePercent.startsWith('-') : null;
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{item.symbol}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                    {item.displayName}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 5px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  {item.watchlistName}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'var(--space-1)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                  {item.currentPrice ? `₹${parseFloat(item.currentPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A'}
                </div>

                {item.dailyMarketChangePercent !== null && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontSize: 'var(--font-size-xs)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)'
                    }}
                  >
                    {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    <span>{isPositive ? '+' : ''}{item.dailyMarketChangePercent}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
