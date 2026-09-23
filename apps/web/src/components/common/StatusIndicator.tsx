import React from 'react';

interface StatusIndicatorProps {
  status?: 'online' | 'warning' | 'offline';
  label?: string;
  sublabel?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status = 'online',
  label = 'SYS_ONLINE',
  sublabel
}) => {
  const statusColors = {
    online: 'var(--color-positive)',
    warning: 'var(--color-warning)',
    offline: 'var(--color-negative)'
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '4px 10px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-pill)',
        fontSize: 'var(--font-size-xs)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-text-secondary)',
        userSelect: 'none'
      }}
      aria-label={`System Status: ${label}`}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: statusColors[status],
          boxShadow: `0 0 6px ${statusColors[status]}`
        }}
      />
      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>
      {sublabel && <span style={{ opacity: 0.7 }}>| {sublabel}</span>}
    </div>
  );
};
