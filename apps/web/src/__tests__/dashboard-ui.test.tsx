// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CommandCenterPage } from '../pages/CommandCenterPage';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { AttentionBanner } from '../components/dashboard/AttentionBanner';
import { PortfolioSnapshot } from '../components/dashboard/PortfolioSnapshot';
import { TopHoldingsTable } from '../components/dashboard/TopHoldingsTable';
import { WatchlistMatrix } from '../components/dashboard/WatchlistMatrix';
import { IPOPipeline } from '../components/dashboard/IPOPipeline';
import { KhataSummary } from '../components/dashboard/KhataSummary';
import { ActivityStream } from '../components/dashboard/ActivityStream';
import { DashboardSummaryDTO, DashboardSection } from '@finance-command-center/shared-types';

describe('Phase 15 Unified Dashboard & Financial Command Center UI Suite', () => {
  const mockSummaryDTO: DashboardSummaryDTO = {
    headerTelemetry: {
      status: 'SUCCESS',
      data: {
        portfolioMarketValue: '150000.0000',
        dailyMarketChangePercent: '2.45',
        totalRealizedPnL: '12000.0000',
        totalUnrealizedPnL: '25000.0000',
        totalPnL: '37000.0000',
        khataNetBalance: '5000.0000',
        unreadNotificationsCount: 3,
        activeAlertRulesCount: 5,
        overallFreshness: 'LIVE',
        valuationPartial: false
      }
    },
    portfolioOverview: {
      status: 'SUCCESS',
      data: {
        portfolioCount: 2,
        totalMarketValue: '150000.0000',
        totalAcquisitionCost: '125000.0000',
        unrealizedPnL: '25000.0000',
        unrealizedPnLPercent: '20.00',
        realizedPnL: '12000.0000',
        totalPnL: '37000.0000',
        simpleReturnPercent: '29.60',
        xirrPercent: null,
        xirrStatus: 'UNAVAILABLE',
        valuationCoveragePercentage: '100.00',
        overallFreshness: 'LIVE',
        valuationPartial: false
      }
    },
    topHoldings: {
      status: 'SUCCESS',
      data: [
        {
          instrumentId: 'inst-1',
          symbol: 'RELIANCE',
          displayName: 'Reliance Industries Ltd',
          quantity: '50.0000',
          averageCost: '2000.0000',
          currentPrice: '2500.0000',
          marketValue: '125000.0000',
          unrealizedPnL: '25000.0000',
          unrealizedPnLPercent: '25.00',
          dailyMarketChangePercent: '1.80',
          dataFreshness: 'LIVE'
        }
      ]
    },
    watchlistSummary: {
      status: 'SUCCESS',
      data: [
        {
          id: 'item-1',
          watchlistId: 'wl-1',
          watchlistName: 'Core Tech',
          instrumentId: 'inst-2',
          symbol: 'TCS',
          displayName: 'Tata Consultancy Services',
          currentPrice: '3800.0000',
          dailyMarketChangePercent: '-0.50',
          dataFreshness: 'LIVE'
        }
      ]
    },
    ipoSummary: {
      status: 'SUCCESS',
      data: {
        activeIpos: [
          {
            id: 'ipo-1',
            ipoName: 'Swiggy Limited IPO',
            issuerName: 'Swiggy Ltd',
            symbol: 'SWIGGY',
            status: 'OPEN',
            openDate: '2026-09-20T00:00:00Z',
            closeDate: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
            closingSoon: true,
            priceBandLow: '371.0000',
            priceBandHigh: '390.0000'
          }
        ],
        userApplications: [
          {
            id: 'app-1',
            userId: '00000000-0000-0000-0000-000000000001',
            ipoId: 'ipo-1',
            applicationAccountId: 'acc-1',
            applicationDate: '2026-09-21T10:00:00Z',
            lotsApplied: 2,
            quantityApplied: 76,
            applicationAmount: '29640.0000',
            status: 'COMPLETED',
            createdAt: '2026-09-21T10:00:00Z',
            updatedAt: '2026-09-21T10:00:00Z',
            ipoName: 'Swiggy Limited IPO'
          }
        ]
      }
    },
    khataSummary: {
      status: 'SUCCESS',
      data: {
        totalNetBalance: '5000.0000',
        totalReceivable: '10000.0000',
        totalPayable: '5000.0000',
        activeAccountsCount: 2,
        recentTransactions: [
          {
            id: 'tx-1',
            accountId: 'acc-k1',
            accountName: 'Rahul Verma',
            type: 'MONEY_IN',
            amount: '2000.0000',
            runningBalance: '5000.0000',
            transactionDate: '2026-09-21T14:00:00Z',
            description: 'UPI Settlement'
          }
        ]
      }
    },
    alertsSummary: {
      status: 'SUCCESS',
      data: {
        activeRulesCount: 5,
        unreadCount: 3,
        recentNotifications: []
      }
    },
    activityStream: {
      status: 'SUCCESS',
      data: [
        {
          id: 'act-1',
          category: 'IPO',
          title: 'IPO Application Completed',
          description: 'Applied 2 lots for Swiggy Limited IPO',
          timestamp: '2026-09-21T10:00:00Z'
        },
        {
          id: 'act-2',
          category: 'KHATA',
          title: 'Khata Payment Received',
          description: '₹2,000 received from Rahul Verma',
          timestamp: '2026-09-21T14:00:00Z'
        }
      ]
    },
    generatedAt: new Date().toISOString()
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. renders CommandCenterPage and fetches summary DTO from backend API', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      expect(urlStr).toContain('/api/v1/dashboard/summary');
      expect(init?.headers).toMatchObject({ 'x-user-id': expect.any(String) });

      return {
        ok: true,
        json: async () => ({ success: true, data: mockSummaryDTO })
      } as Response;
    });

    render(<CommandCenterPage />);

    expect(screen.getByLabelText('Loading data')).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText('Financial Command Center').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Refresh Deck').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Portfolio Snapshot').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Top Holdings Breakdown').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Watchlist Pulse').length).toBeGreaterThan(0);
    expect(screen.getAllByText('IPO Pipeline & Applications').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Digital Khata Summary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unified Activity Stream').length).toBeGreaterThan(0);
  });

  it('2. renders DashboardHeader telemetry strip with correct metrics', () => {
    render(<DashboardHeader telemetrySection={mockSummaryDTO.headerTelemetry} />);

    expect(screen.getAllByText('Portfolio Value').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹1,50,000.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unrealized P&L').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹25,000.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Khata Cash Net').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 Unread/).length).toBeGreaterThan(0);
  });

  it('3. renders AttentionBanner when closing IPOs and unread notifications exist', () => {
    render(
      <AttentionBanner
        ipoSection={mockSummaryDTO.ipoSummary}
        alertsSection={mockSummaryDTO.alertsSummary}
        overallFreshness="LIVE"
        valuationPartial={true}
      />
    );

    expect(screen.getAllByText(/Action Required \/ System Attention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Swiggy Limited IPO/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 unread notification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Valuation Partial/i).length).toBeGreaterThan(0);
  });

  it('4. renders PortfolioSnapshot with multi-portfolio Simple Return & XIRR unavailable state', () => {
    render(<PortfolioSnapshot portfolioSection={mockSummaryDTO.portfolioOverview} />);

    expect(screen.getAllByText('2 Portfolios').length).toBeGreaterThan(0);
    expect(screen.getAllByText('29.60%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('UNAVAILABLE (Multi-Portfolio)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100.00%').length).toBeGreaterThan(0);
  });

  it('5. renders TopHoldingsTable with instrument data', () => {
    render(<TopHoldingsTable holdingsSection={mockSummaryDTO.topHoldings} />);

    expect(screen.getAllByText('RELIANCE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reliance Industries Ltd').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹1,25,000.00').length).toBeGreaterThan(0);
  });

  it('6. renders WatchlistMatrix with tracked asset cards', () => {
    render(<WatchlistMatrix watchlistSection={mockSummaryDTO.watchlistSummary} />);

    expect(screen.getAllByText('TCS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tata Consultancy Services').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Core Tech').length).toBeGreaterThan(0);
  });

  it('7. renders IPOPipeline with CLOSING SOON badge and user applications', () => {
    render(<IPOPipeline ipoSection={mockSummaryDTO.ipoSummary} />);

    expect(screen.getAllByText('Swiggy Limited IPO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CLOSING SOON').length).toBeGreaterThan(0);
    expect(screen.getAllByText('My Active Applications (1)').length).toBeGreaterThan(0);
  });

  it('8. renders KhataSummary with net cash balance and recent transactions', () => {
    render(<KhataSummary khataSection={mockSummaryDTO.khataSummary} />);

    expect(screen.getAllByText('Digital Khata Summary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹5,000.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rahul Verma').length).toBeGreaterThan(0);
  });

  it('9. renders ActivityStream with category badges and timestamps', () => {
    render(<ActivityStream activitySection={mockSummaryDTO.activityStream} />);

    expect(screen.getAllByText('Unified Activity Stream').length).toBeGreaterThan(0);
    expect(screen.getAllByText('IPO Application Completed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Khata Payment Received').length).toBeGreaterThan(0);
    expect(screen.getAllByText('IPO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('KHATA').length).toBeGreaterThan(0);
  });

  it('10. renders component-level error container when an individual section fails (partial failure model)', () => {
    const errorIpoSection: DashboardSection<{ activeIpos: any[]; userApplications: any[] }> = {
      status: 'ERROR',
      data: null,
      errorMessage: 'IPO database connection timed out'
    };

    render(<IPOPipeline ipoSection={errorIpoSection} />);

    expect(screen.getAllByText('IPO Pipeline Error:').length).toBeGreaterThan(0);
    expect(screen.getAllByText('IPO database connection timed out').length).toBeGreaterThan(0);
  });
});
