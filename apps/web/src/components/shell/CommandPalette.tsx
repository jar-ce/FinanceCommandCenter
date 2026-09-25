import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
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
  X,
  ArrowRight
} from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  category: string;
  path: string;
  icon: React.ReactNode;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    { id: 'cmd-center', label: 'Go to Command Center', category: 'Navigation', path: '/', icon: <LayoutDashboard size={16} /> },
    { id: 'khata', label: 'Go to Digital Khata', category: 'Operations', path: '/khata', icon: <BookOpen size={16} /> },
    { id: 'ipo-dash', label: 'Go to IPO Dashboard', category: 'IPO Center', path: '/ipo', icon: <Flame size={16} /> },
    { id: 'ipo-apps', label: 'Go to IPO Applications', category: 'IPO Center', path: '/ipo/applications', icon: <FileText size={16} /> },
    { id: 'ipo-allot', label: 'Go to IPO Allotment Checker', category: 'IPO Center', path: '/ipo/allotment', icon: <CheckCircle2 size={16} /> },
    { id: 'markets', label: 'Go to Market Overview', category: 'Markets', path: '/markets', icon: <TrendingUp size={16} /> },
    { id: 'stocks', label: 'Go to Stocks Explorer', category: 'Markets', path: '/markets/stocks', icon: <BarChart2 size={16} /> },
    { id: 'watchlist', label: 'Go to Watchlist', category: 'Markets', path: '/markets/watchlist', icon: <Star size={16} /> },
    { id: 'holdings', label: 'Go to Portfolio Holdings', category: 'Portfolio', path: '/portfolio', icon: <Briefcase size={16} /> },
    { id: 'transactions', label: 'Go to Transactions Log', category: 'Portfolio', path: '/portfolio/transactions', icon: <Receipt size={16} /> },
    { id: 'pnl', label: 'Go to P&L Statement', category: 'Portfolio', path: '/portfolio/pnl', icon: <DollarSign size={16} /> },
    { id: 'alerts', label: 'Go to Alerts', category: 'Intelligence', path: '/alerts', icon: <Bell size={16} /> },
    { id: 'reports', label: 'Go to Reports', category: 'Intelligence', path: '/reports', icon: <FileSpreadsheet size={16} /> },
    { id: 'analytics', label: 'Go to Analytics', category: 'Intelligence', path: '/analytics', icon: <PieChart size={16} /> },
    { id: 'notifications', label: 'Go to System Notifications', category: 'System', path: '/notifications', icon: <Inbox size={16} /> },
    { id: 'settings', label: 'Go to Settings', category: 'System', path: '/settings', icon: <Settings size={16} /> }
  ];

  const filteredCommands = React.useMemo(
    () =>
      commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.category.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleExecute = (item: CommandItem) => {
    navigate(item.path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleExecute(filteredCommands[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette Overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 19, 28, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Command Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            gap: 'var(--space-3)'
          }}
        >
          <Search size={20} color="var(--color-brand-primary)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search section..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-md)'
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Command List */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: 'var(--space-2)' }}>
          {filteredCommands.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-8)',
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-base)'
              }}
            >
              No matching commands found for "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleExecute(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected ? 'var(--color-bg-elevated)' : 'transparent',
                    color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ color: isSelected ? 'var(--color-brand-primary)' : 'inherit' }}>
                      {cmd.icon}
                    </span>
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>{cmd.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 6px',
                        backgroundColor: 'var(--color-bg-app)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-muted)'
                      }}
                    >
                      {cmd.category}
                    </span>
                    {isSelected && <ArrowRight size={14} color="var(--color-brand-primary)" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-app)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          <span>↑↓ Navigate | ↵ Select | ESC Close</span>
          <span>APEX COMMAND V1</span>
        </div>
      </div>
    </div>
  );
};
