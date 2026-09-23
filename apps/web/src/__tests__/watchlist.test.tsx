import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WatchlistPage } from '../pages/WatchlistPage';

describe('Frontend Phase 11 Watchlist Workspace Component Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockWatchlist = {
    id: '00000000-0000-4000-a000-000000000100',
    userId: '00000000-0000-4000-a000-000000000001',
    name: 'Tech & Metals Core',
    description: 'Long term watchlist',
    status: 'ACTIVE',
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    itemCount: 1,
    items: [
      {
        id: '00000000-0000-4000-a000-000000000200',
        watchlistId: '00000000-0000-4000-a000-000000000100',
        instrumentId: '00000000-0000-4000-a000-000000000300',
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        instrument: {
          id: '00000000-0000-4000-a000-000000000300',
          symbol: 'TATASTEEL',
          displayName: 'Tata Steel Limited',
          exchange: 'NSE',
          market: 'IN',
          securityType: 'EQUITY',
          currency: 'INR',
          provider: 'NSE_INDIA',
          status: 'ACTIVE'
        },
        quote: {
          id: '00000000-0000-4000-a000-000000000400',
          instrumentId: '00000000-0000-4000-a000-000000000300',
          lastPrice: '150.2500',
          previousClose: '148.0000',
          change: '2.2500',
          changePercent: '1.5203',
          currency: 'INR',
          marketStatus: 'OPEN',
          dataFreshness: 'LIVE',
          retrievedAt: new Date().toISOString(),
          provider: 'NSE_INDIA'
        }
      }
    ]
  };

  it('renders Watchlist workspace header and empty state when no watchlists exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/watchlists')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }));

    render(
      <MemoryRouter>
        <WatchlistPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Watchlist Workspace')).toBeDefined();
    expect(screen.getByText('PHASE 11')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('No Watchlists Found')).toBeDefined();
    });
  });

  it('renders watchlist selector, summary strip, and ResizableTable when watchlist data exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/api/v1/watchlists?includeArchived=false')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [mockWatchlist] })
        });
      }
      if (url.includes('/api/v1/watchlists/00000000-0000-4000-a000-000000000100')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockWatchlist })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }));

    render(
      <MemoryRouter>
        <WatchlistPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TATASTEEL')).toBeDefined();
      expect(screen.getByText('Tata Steel Limited')).toBeDefined();
      expect(screen.getByText('₹150.25')).toBeDefined();
      expect(screen.getByText('● LIVE')).toBeDefined();
      expect(screen.getByText('OPEN')).toBeDefined();
    });
  });

  it('opens Create Watchlist modal when New Watchlist button is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [mockWatchlist] })
      });
    }));

    render(
      <MemoryRouter>
        <WatchlistPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /New Watchlist/i });
      fireEvent.click(btn);
    });

    expect(screen.getByText('Create New Watchlist')).toBeDefined();
  });
});
