import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Flame,
  FileText,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  Star,
  Briefcase,
  Receipt,
  DollarSign,
  Bell,
  FileSpreadsheet,
  PieChart,
  Inbox,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { NavigationItem, NavItemConfig } from './NavigationItem';
import { IconButton } from '../common/IconButton';

interface NavigationGroup {
  title: string;
  items: NavItemConfig[];
}

interface CommandRailProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const CommandRail: React.FC<CommandRailProps> = ({
  isCollapsed,
  onToggleCollapse
}) => {
  const navGroups: NavigationGroup[] = [
    {
      title: 'COMMAND CENTER',
      items: [
        { path: '/', label: 'Command Center', icon: <LayoutDashboard size={18} /> }
      ]
    },
    {
      title: 'DIGITAL KHATA',
      items: [
        { path: '/khata', label: 'Ledger Accounts', icon: <BookOpen size={18} /> }
      ]
    },
    {
      title: 'IPO CENTER',
      items: [
        { path: '/ipo', label: 'IPO Dashboard', icon: <Flame size={18} /> },
        { path: '/ipo/applications', label: 'Applications', icon: <FileText size={18} /> },
        { path: '/ipo/allotment', label: 'Allotment Checker', icon: <CheckCircle2 size={18} /> }
      ]
    },
    {
      title: 'MARKETS & STOCKS',
      items: [
        { path: '/markets', label: 'Market Overview', icon: <TrendingUp size={18} /> },
        { path: '/markets/stocks', label: 'Stocks Explorer', icon: <BarChart2 size={18} /> },
        { path: '/markets/watchlist', label: 'Watchlist', icon: <Star size={18} /> }
      ]
    },
    {
      title: 'PORTFOLIO & P&L',
      items: [
        { path: '/portfolio', label: 'Holdings', icon: <Briefcase size={18} /> },
        { path: '/portfolio/transactions', label: 'Transactions', icon: <Receipt size={18} /> },
        { path: '/portfolio/pnl', label: 'P&L Statement', icon: <DollarSign size={18} /> }
      ]
    },
    {
      title: 'INTELLIGENCE',
      items: [
        { path: '/alerts', label: 'Alerts', icon: <Bell size={18} /> },
        { path: '/reports', label: 'Reports', icon: <FileSpreadsheet size={18} /> },
        { path: '/analytics', label: 'Analytics', icon: <PieChart size={18} /> }
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { path: '/notifications', label: 'Notifications', icon: <Inbox size={18} /> },
        { path: '/settings', label: 'Settings', icon: <Settings size={18} /> }
      ]
    }
  ];

  return (
    <aside
      aria-label="Primary Navigation Command Rail"
      style={{
        width: isCollapsed ? 'var(--rail-width-collapsed)' : 'var(--rail-width-expanded)',
        height: '100vh',
        backgroundColor: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 'var(--z-sticky)',
        overflowX: 'hidden'
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: 'var(--deck-height)',
          padding: '0 var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--color-border)'
        }}
      >
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldAlert size={20} color="var(--color-brand-primary)" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', letterSpacing: '0.05em' }}>
                APEX OS
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                FINANCE COMMAND
              </span>
            </div>
          </div>
        )}
        <IconButton
          icon={isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          ariaLabel={isCollapsed ? 'Expand navigation rail' : 'Collapse navigation rail'}
          onClick={onToggleCollapse}
          variant="ghost"
          size="sm"
        />
      </div>

      {/* Navigation Groups List */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4) var(--space-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)'
        }}
      >
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {!isCollapsed && (
              <div
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  letterSpacing: '0.08em',
                  padding: 'var(--space-1) var(--space-3)'
                }}
              >
                {group.title}
              </div>
            )}
            {group.items.map((item) => (
              <NavigationItem key={item.path} item={item} isCollapsed={isCollapsed} />
            ))}
          </div>
        ))}
      </nav>

      {/* Rail Footer */}
      {!isCollapsed && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            justifyContent: 'space-between'
          }}
        >
          <span>BUILD 0.4.0</span>
          <span>PHASE 4</span>
        </div>
      )}
    </aside>
  );
};
