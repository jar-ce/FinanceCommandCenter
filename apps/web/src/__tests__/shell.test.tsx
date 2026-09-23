import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { CommandRail } from '../components/shell/CommandRail';
import { CommandDeck } from '../components/shell/CommandDeck';

describe('Frontend App Shell & Navigation Architecture', () => {
  it('renders CommandRail navigation bar with APEX OS brand header', () => {
    render(
      <MemoryRouter>
        <CommandRail isCollapsed={false} onToggleCollapse={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText('APEX OS')).toBeDefined();
    expect(screen.getByText('Command Center')).toBeDefined();
    expect(screen.getByText('Ledger Accounts')).toBeDefined();
    expect(screen.getByText('IPO Dashboard')).toBeDefined();
  });

  it('renders CommandDeck header bar with section title and PGlite DB indicator', () => {
    render(
      <MemoryRouter>
        <CommandDeck sectionTitle="IPO Allotment Checker" onOpenCommandPalette={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText('IPO Allotment Checker')).toBeDefined();
    expect(screen.getByText('PGlite DB')).toBeDefined();
  });

  it('renders AppShell layout grid with main content viewport', () => {
    render(
      <MemoryRouter>
        <AppShell activeSectionTitle="Test Title">
          <div data-testid="viewport-content">Test Viewport Content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByTestId('viewport-content')).toBeDefined();
    expect(screen.getByText('Test Viewport Content')).toBeDefined();
  });
});
