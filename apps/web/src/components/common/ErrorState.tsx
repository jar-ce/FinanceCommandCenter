import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'System Error Occurred',
  message = 'An unexpected error occurred while communicating with the backend infrastructure.',
  onRetry
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--space-6)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-negative)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        gap: 'var(--space-3)'
      }}
      role="alert"
    >
      <AlertTriangle size={36} color="var(--color-negative)" />
      <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        {title}
      </h3>
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', maxWidth: '440px' }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 'var(--space-2)',
            padding: '8px 16px',
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          Retry Request
        </button>
      )}
    </div>
  );
};
