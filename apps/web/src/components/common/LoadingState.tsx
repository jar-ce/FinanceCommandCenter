import React from 'react';

interface LoadingStateProps {
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ rows = 3 }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        width: '100%',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)'
      }}
      aria-label="Loading data"
    >
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          style={{
            height: '40px',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: 'var(--radius-md)',
            animation: 'pulse 1.5s infinite ease-in-out',
            opacity: 0.6
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
