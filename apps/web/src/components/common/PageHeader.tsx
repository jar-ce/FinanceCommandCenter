import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  phaseBadge?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  phaseBadge = 'PHASE 4 — PLACEHOLDER SHELL',
  actions
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 'var(--space-4)',
        paddingBottom: 'var(--space-4)',
        borderBottom: '1px solid var(--color-border-subtle)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{title}</h1>
          {phaseBadge && (
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-brand-accent)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)'
              }}
            >
              {phaseBadge}
            </span>
          )}
        </div>
        {description && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
            {description}
          </p>
        )}
      </div>

      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>{actions}</div>}
    </div>
  );
};
