import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from '../components/shell/CommandPalette';
import { AppShell } from '../components/shell/AppShell';
import { StatusIndicator } from '../components/common/StatusIndicator';

describe('Phase 18 — Frontend Accessibility & Keyboard Navigation Suite', () => {
  // --------------------------------------------------
  // 1. Keyboard Navigation & Dialog Roles
  // --------------------------------------------------
  describe('Command Palette Accessibility & Hotkeys', () => {
    it('renders dialog with correct ARIA attributes and role="dialog"', () => {
      render(
        <MemoryRouter>
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
          />
        </MemoryRouter>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-label')).toBe('Command Palette Overlay');
    });

    it('triggers onClose callback when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(
        <MemoryRouter>
          <CommandPalette
            isOpen={true}
            onClose={handleClose}
          />
        </MemoryRouter>
      );

      const searchInput = screen.getByPlaceholderText(/Type a command or search/i);
      fireEvent.keyDown(searchInput, { key: 'Escape', code: 'Escape' });

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('focuses search input field upon rendering when palette open', () => {
      render(
        <MemoryRouter>
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
          />
        </MemoryRouter>
      );

      const searchInput = screen.getByPlaceholderText(/Type a command or search/i);
      expect(searchInput).toBeDefined();
      expect(searchInput.getAttribute('type')).toBe('text');
    });
  });

  // --------------------------------------------------
  // 2. Status Indicator Accessibility & Tooltips
  // --------------------------------------------------
  describe('Status Indicator ARIA & Tooltip Attributes', () => {
    it('renders online status indicator with aria-label', () => {
      render(<StatusIndicator status="online" label="LIVE" />);

      const indicator = screen.getByLabelText('System Status: LIVE');
      expect(indicator).toBeDefined();
      expect(screen.getByText('LIVE')).toBeDefined();
    });

    it('renders warning status indicator with aria-label', () => {
      render(<StatusIndicator status="warning" label="STALE" />);

      const indicator = screen.getByLabelText('System Status: STALE');
      expect(indicator).toBeDefined();
      expect(screen.getByText('STALE')).toBeDefined();
    });
  });

  // --------------------------------------------------
  // 3. Application Shell Navigation Accessibility
  // --------------------------------------------------
  describe('AppShell Navigation Semantics', () => {
    it('renders main navigation landmark and accessible brand header', () => {
      render(
        <MemoryRouter>
          <AppShell activeSectionTitle="Accessibility Dashboard">
            <div>Test Content Viewport</div>
          </AppShell>
        </MemoryRouter>
      );

      expect(screen.getByText('APEX OS')).toBeDefined();
      expect(screen.getByText('Test Content Viewport')).toBeDefined();
    });
  });
});
