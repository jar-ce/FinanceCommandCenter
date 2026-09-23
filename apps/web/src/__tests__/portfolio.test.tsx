// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PortfolioPage } from '../pages/PortfolioPage';

describe('Frontend Phase 12 Portfolio Workspace Component Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockPortfolio = {
    id: '00000000-0000-4000-a000-000000000100',
    userId: '00000000-0000-4000-a000-000000000001',
    name: 'Core Growth Portfolio',
    description: 'Strategic equity holdings',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    holdingCount: 1,
    holdings: [
      {
        instrumentId: '00000000-0000-4000-a000-000000000300',
        symbol: 'RELIANCE',
        displayName: 'Reliance Industries Limited',
        exchange: 'NSE',
        market: 'IN',
        securityType: 'EQUITY',
        currency: 'INR',
        quantity: '10.0000',
        averageCost: '2002.5000',
        totalAcquisitionCost: '20025.0000',
        currentPrice: '2500.0000',
        marketValue: '25000.0000',
        unrealizedGainLoss: '4975.0000',
        unrealizedGainLossPercent: '24.8439',
        marketStatus: 'OPEN',
        dataFreshness: 'LIVE',
        asOf: new Date().toISOString()
      }
    ]
  };

  it('renders Portfolio workspace header and empty state when no portfolios exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/v1/portfolios') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }));

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Portfolio Workspace')).toBeDefined();
    expect(screen.getByText('PHASE 12')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('No Portfolios Found')).toBeDefined();
    });
  });

  it('renders portfolio selector, metrics strip, and holdings ResizableTable when portfolio data exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/transactions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      if (u.pathname === '/api/v1/portfolios') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [mockPortfolio] })
        });
      }
      if (u.pathname === `/api/v1/portfolios/${mockPortfolio.id}`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockPortfolio })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }));

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Core Growth Portfolio/i).length).toBeGreaterThan(0);
      expect(screen.getByText('RELIANCE')).toBeDefined();
      expect(screen.getByText('Reliance Industries Limited')).toBeDefined();
      expect(screen.getAllByText(/LIVE/i).length).toBeGreaterThan(0);
    });
  });

  it('opens Create Portfolio modal when New Portfolio button is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/transactions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      if (u.pathname === '/api/v1/portfolios') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [mockPortfolio] })
        });
      }
      if (u.pathname === `/api/v1/portfolios/${mockPortfolio.id}`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockPortfolio })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }));

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /New Portfolio/i });
      expect(btns.length).toBeGreaterThan(0);
      fireEvent.click(btns[0]);
    });

    expect(screen.getByText('Create New Portfolio')).toBeDefined();
  });
});
