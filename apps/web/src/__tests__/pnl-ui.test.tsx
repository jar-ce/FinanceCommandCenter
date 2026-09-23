// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PortfolioPage } from '../pages/PortfolioPage';

describe('Frontend Phase 13 P&L & Portfolio Analytics Workspace Suite', () => {
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

  const mockPnLSummary = {
    portfolioId: '00000000-0000-4000-a000-000000000100',
    realizedPnL: '71.0000',
    unrealizedPnL: '4975.0000',
    totalPnL: '5046.0000',
    totalAcquisitionCost: '20025.0000',
    totalMarketValue: '25000.0000',
    valuationCoverage: {
      totalHoldingsCount: 1,
      valuedHoldingsCount: 1,
      unvaluedHoldingsCount: 0,
      coveragePercentage: '100.0000',
      overallFreshness: 'LIVE'
    },
    returnMetrics: {
      simpleReturnPercent: '25.1985',
      xirrPercent: '32.1450',
      xirrStatus: 'CALCULATED',
      cagrPercent: null,
      cagrStatus: 'UNAVAILABLE'
    },
    asOf: new Date().toISOString()
  };

  const mockHoldingPnL = [
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
      unrealizedPnL: '4975.0000',
      unrealizedPnLPercent: '24.8439',
      realizedPnL: '71.0000',
      totalPnL: '5046.0000',
      marketStatus: 'OPEN',
      dataFreshness: 'LIVE',
      asOf: new Date().toISOString()
    }
  ];

  const mockRealizedPnL = [
    {
      transactionId: '00000000-0000-4000-a000-000000000999',
      portfolioId: '00000000-0000-4000-a000-000000000100',
      instrumentId: '00000000-0000-4000-a000-000000000300',
      symbol: 'RELIANCE',
      displayName: 'Reliance Industries Limited',
      exchange: 'NSE',
      transactionDate: '2026-01-15T10:00:00Z',
      soldQuantity: '4.0000',
      price: '120.0000',
      grossProceeds: '480.0000',
      charges: '3.0000',
      taxes: '2.0000',
      netProceeds: '475.0000',
      averageCostBeforeSell: '101.0000',
      costRemoved: '404.0000',
      realizedPnL: '71.0000'
    }
  ];

  it('renders P&L Analytics tab button and displays P&L summary metrics when clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/pnl/holdings')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: mockHoldingPnL }) });
      }
      if (u.pathname.endsWith('/pnl/realized')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: mockRealizedPnL }) });
      }
      if (u.pathname.endsWith('/pnl')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: mockPnLSummary }) });
      }
      if (u.pathname === '/api/v1/portfolios') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [mockPortfolio] }) });
      }
      if (u.pathname === `/api/v1/portfolios/${mockPortfolio.id}`) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: mockPortfolio }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }));

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('P&L Analytics')).toBeDefined();
    });

    const pnlTabBtn = screen.getByText('P&L Analytics');
    fireEvent.click(pnlTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Realized P&L')).toBeDefined();
      expect(screen.getByText('Unrealized P&L')).toBeDefined();
      expect(screen.getByText('Total Portfolio P&L')).toBeDefined();
      expect(screen.getByText('XIRR Return')).toBeDefined();
      expect(screen.getByText('32.1450%')).toBeDefined();
      expect(screen.getByText('1 / 1 Valued')).toBeDefined();
    });
  });

  it('switches to Realized P&L Ledger tab and displays date filter preset buttons', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/pnl/holdings')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: mockHoldingPnL }) });
      }
      if (u.pathname.endsWith('/pnl/realized')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: mockRealizedPnL }) });
      }
      if (u.pathname.endsWith('/pnl')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: mockPnLSummary }) });
      }
      if (u.pathname === '/api/v1/portfolios') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [mockPortfolio] }) });
      }
      if (u.pathname === `/api/v1/portfolios/${mockPortfolio.id}`) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: mockPortfolio }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }));

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Realized P&L Ledger/i)).toBeDefined();
    });

    const realizedTabBtn = screen.getByText(/Realized P&L Ledger/i);
    fireEvent.click(realizedTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Time Range:')).toBeDefined();
      expect(screen.getByText('ALL')).toBeDefined();
      expect(screen.getByText('1M')).toBeDefined();
      expect(screen.getByText('1Y')).toBeDefined();
      expect(screen.getByText('Cost Basis Removed')).toBeDefined();
    });
  });
});
