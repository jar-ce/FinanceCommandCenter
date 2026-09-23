import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StockSearchPage } from '../pages/StockSearchPage';
import { StockDetailsPage } from '../pages/StockDetailsPage';

describe('Frontend Phase 10 Stock Search & Instrument Details Workspace Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Stock Search Page Component Suite', () => {
    it('renders Stock Search header, zero fake data badge, and empty/search guidance state', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/market/instruments')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: [],
              meta: { totalCount: 0, page: 1, limit: 50 }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }));

      render(
        <MemoryRouter>
          <StockSearchPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Stock Search & Securities Master')).toBeDefined();
      expect(screen.getByText('ZERO FAKE DATA POLICY')).toBeDefined();

      await waitFor(() => {
        expect(screen.getByText('Search Canonical Securities Master')).toBeDefined();
      });
    });

    it('renders search query results in ResizableTable when matching instruments exist', async () => {
      const mockInstruments = [
        {
          id: '00000000-0000-4000-a000-000000000100',
          symbol: 'RELIANCE',
          displayName: 'Reliance Industries Limited',
          exchange: 'NSE',
          market: 'IN',
          securityType: 'EQUITY',
          currency: 'INR',
          provider: 'NSE_INDIA',
          providerInstrumentId: 'NSE_RELIANCE_EQ',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/market/instruments')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: mockInstruments,
              meta: { totalCount: 1, page: 1, limit: 50 }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }));

      render(
        <MemoryRouter>
          <StockSearchPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeDefined();
        expect(screen.getByText('Reliance Industries Limited')).toBeDefined();
        expect(screen.getByText('NSE')).toBeDefined();
        expect(screen.getByText('ACTIVE')).toBeDefined();
      });
    });
  });

  describe('2. Instrument Details Page Component Suite', () => {
    it('renders instrument header, quote metrics, freshness badges, and timestamps', async () => {
      const mockInstrument = {
        id: '00000000-0000-4000-a000-000000000100',
        symbol: 'RELIANCE',
        displayName: 'Reliance Industries Limited',
        exchange: 'NSE',
        market: 'IN',
        securityType: 'EQUITY',
        currency: 'INR',
        provider: 'NSE_INDIA',
        providerInstrumentId: 'NSE_RELIANCE_EQ',
        status: 'ACTIVE',
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z'
      };

      const mockQuote = {
        id: '00000000-0000-4000-a000-000000000200',
        instrumentId: '00000000-0000-4000-a000-000000000100',
        lastPrice: '2540.0000',
        previousClose: '2500.0000',
        open: '2505.0000',
        high: '2550.0000',
        low: '2495.0000',
        close: '2540.0000',
        volume: 1250000,
        change: '40.0000',
        changePercent: '1.6000',
        currency: 'INR',
        marketStatus: 'OPEN',
        dataFreshness: 'LIVE',
        asOf: '2026-09-17T08:00:00Z',
        retrievedAt: '2026-09-17T08:00:02Z',
        provider: 'NSE_INDIA',
        createdAt: '2026-09-17T08:00:02Z',
        updatedAt: '2026-09-17T08:00:02Z'
      };

      const mockHistory = [
        { timestamp: '2026-09-16T10:00:00Z', open: '2500', high: '2520', low: '2490', close: '2510', volume: 100000, interval: '1D', adjustmentStatus: 'RAW' },
        { timestamp: '2026-09-17T10:00:00Z', open: '2510', high: '2550', low: '2495', close: '2540', volume: 120000, interval: '1D', adjustmentStatus: 'RAW' }
      ];

      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/market/instruments/00000000-0000-4000-a000-000000000100/quote')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockQuote })
          });
        }
        if (url.includes('/api/v1/market/instruments/00000000-0000-4000-a000-000000000100/history')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockHistory })
          });
        }
        if (url.includes('/api/v1/market/instruments/00000000-0000-4000-a000-000000000100')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockInstrument })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: null })
        });
      }));

      render(
        <MemoryRouter initialEntries={['/stocks/00000000-0000-4000-a000-000000000100']}>
          <Routes>
            <Route path="/stocks/:id" element={<StockDetailsPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('RELIANCE').length).toBeGreaterThan(0);
        expect(screen.getByText('Reliance Industries Limited')).toBeDefined();
        expect(screen.getByText('₹2,540.00')).toBeDefined();
        expect(screen.getByText('₹2,500.00')).toBeDefined();
        expect(screen.getByText('● LIVE')).toBeDefined();
        expect(screen.getByText('MARKET OPEN')).toBeDefined();
        expect(screen.getByText('Historical Price Visualization')).toBeDefined();
      });
    });

    it('displays STALE warning banner when cached quote freshness is marked STALE', async () => {
      const mockInstrument = {
        id: '00000000-0000-4000-a000-000000000100',
        symbol: 'TCS',
        displayName: 'Tata Consultancy Services Ltd',
        exchange: 'NSE',
        market: 'IN',
        securityType: 'EQUITY',
        currency: 'INR',
        provider: 'NSE_INDIA',
        status: 'ACTIVE'
      };

      const mockStaleQuote = {
        id: '00000000-0000-4000-a000-000000000201',
        instrumentId: '00000000-0000-4000-a000-000000000100',
        lastPrice: '3800.0000',
        previousClose: '3780.0000',
        change: '20.0000',
        changePercent: '0.5291',
        currency: 'INR',
        marketStatus: 'CLOSED',
        dataFreshness: 'STALE',
        asOf: '2026-09-16T15:30:00Z',
        retrievedAt: '2026-09-17T08:00:00Z',
        provider: 'NSE_INDIA'
      };

      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('/quote')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockStaleQuote })
          });
        }
        if (url.includes('/history')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: [] })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockInstrument })
        });
      }));

      render(
        <MemoryRouter initialEntries={['/stocks/00000000-0000-4000-a000-000000000100']}>
          <Routes>
            <Route path="/stocks/:id" element={<StockDetailsPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('TCS').length).toBeGreaterThan(0);
        expect(screen.getByText('▲ STALE DATA')).toBeDefined();
        expect(screen.getByText(/STALE DATA NOTICE/i)).toBeDefined();
      });
    });

    it('renders EmptyState when instrument ID does not exist (404)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ success: false, error: { code: 'NOT_FOUND', message: 'Market instrument not found.' } })
        });
      }));

      render(
        <MemoryRouter initialEntries={['/stocks/00000000-0000-4000-a000-999999999999']}>
          <Routes>
            <Route path="/stocks/:id" element={<StockDetailsPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Instrument Not Found')).toBeDefined();
      });
    });
  });
});
