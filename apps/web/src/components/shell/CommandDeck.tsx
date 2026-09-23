import React from 'react';
import { Search, User, Command } from 'lucide-react';
import { StatusIndicator } from '../common/StatusIndicator';
import { IconButton } from '../common/IconButton';
import { NotificationCenter } from './NotificationCenter';

interface CommandDeckProps {
  onOpenCommandPalette: () => void;
  sectionTitle?: string;
}

export const CommandDeck: React.FC<CommandDeckProps> = ({
  onOpenCommandPalette,
  sectionTitle = 'Command Center'
}) => {
  return (
    <header
      aria-label="Command Deck Header"
      style={{
        height: 'var(--deck-height)',
        backgroundColor: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      {/* Left: Section Context & Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
          APEX OS /
        </span>
        <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {sectionTitle}
        </span>
      </div>

      {/* Middle: Command Palette Trigger Button */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: '6px 14px',
          backgroundColor: 'var(--color-bg-app)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          width: '320px',
          transition: 'all var(--transition-fast)'
        }}
        aria-label="Open Command Palette (Control + K)"
      >
        <Search size={16} color="var(--color-text-muted)" />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
          Search commands, pages...
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-secondary)'
          }}
        >
          <Command size={10} />
          <span>K</span>
        </div>
      </button>

      {/* Right: Status Indicator & Shell Placeholders */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <StatusIndicator status="online" label="PGlite DB" sublabel="v16 Wasm" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <NotificationCenter />
          <IconButton
            icon={<User size={18} />}
            ariaLabel="User Profile & Settings"
            variant="ghost"
            size="md"
          />
        </div>
      </div>
    </header>
  );
};
