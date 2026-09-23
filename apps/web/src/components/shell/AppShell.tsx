import React, { useState, useEffect } from 'react';
import { CommandRail } from './CommandRail';
import { CommandDeck } from './CommandDeck';
import { CommandPalette } from './CommandPalette';

interface AppShellProps {
  children: React.ReactNode;
  activeSectionTitle?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeSectionTitle = 'Command Center'
}) => {
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global Keyboard Shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-app)',
        color: 'var(--color-text-primary)'
      }}
    >
      {/* Primary Left Navigation Command Rail */}
      <CommandRail
        isCollapsed={isRailCollapsed}
        onToggleCollapse={() => setIsRailCollapsed((prev) => !prev)}
      />

      {/* Main Viewport Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflowX: 'hidden'
        }}
      >
        {/* Top Control Header */}
        <CommandDeck
          sectionTitle={activeSectionTitle}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        {/* Dynamic Page Viewport */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>

      {/* Global Command Palette Overlay (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};
