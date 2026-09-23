import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  ariaLabel: string;
  variant?: 'ghost' | 'surface' | 'primary';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  ariaLabel,
  variant = 'ghost',
  size = 'md',
  style,
  disabled,
  ...props
}) => {
  const sizes = {
    sm: { width: '28px', height: '28px', fontSize: '14px' },
    md: { width: '36px', height: '36px', fontSize: '18px' },
    lg: { width: '44px', height: '44px', fontSize: '22px' }
  };

  const variants = {
    ghost: {
      backgroundColor: 'transparent',
      border: '1px solid transparent',
      color: 'var(--color-text-secondary)'
    },
    surface: {
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text-primary)'
    },
    primary: {
      backgroundColor: 'var(--color-brand-primary)',
      border: '1px solid var(--color-brand-primary)',
      color: '#FFFFFF'
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all var(--transition-fast)',
        opacity: disabled ? 0.5 : 1,
        ...sizes[size],
        ...variants[variant],
        ...style
      }}
      onMouseEnter={(e) => {
        if (!disabled && variant === 'ghost') {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
          e.currentTarget.style.color = 'var(--color-text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && variant === 'ghost') {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }
      }}
      {...props}
    >
      {icon}
    </button>
  );
};
