import React from 'react';
import { NavLink } from 'react-router-dom';
import { Tooltip } from '../common/Tooltip';

export interface NavItemConfig {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavigationItemProps {
  item: NavItemConfig;
  isCollapsed?: boolean;
}

export const NavigationItem: React.FC<NavigationItemProps> = ({
  item,
  isCollapsed = false
}) => {
  const content = (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)',
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        backgroundColor: isActive ? 'var(--color-bg-elevated)' : 'transparent',
        fontWeight: isActive ? 600 : 400,
        fontSize: 'var(--font-size-base)',
        borderLeft: isActive ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
        transition: 'all var(--transition-fast)',
        textDecoration: 'none',
        outline: 'none',
        justifyContent: isCollapsed ? 'center' : 'flex-start'
      })}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.icon}
      </span>
      {!isCollapsed && (
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.label}
        </span>
      )}
      {!isCollapsed && item.badge && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-mono)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-brand-accent)',
            border: '1px solid var(--color-border)'
          }}
        >
          {item.badge}
        </span>
      )}
    </NavLink>
  );

  if (isCollapsed) {
    return <Tooltip content={item.label}>{content}</Tooltip>;
  }

  return content;
};
