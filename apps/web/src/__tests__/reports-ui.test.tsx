// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportsPage } from '../pages/ReportsPage';
import { ReportHeader } from '../components/reports/ReportHeader';
import { DateRangePicker } from '../components/reports/DateRangePicker';
import { PortfolioReportView } from '../components/reports/PortfolioReportView';
import { KhataReportView } from '../components/reports/KhataReportView';
import {
  PortfolioPerformanceReportDTO,
  AssetAllocationReportDTO,
  KhataCashFlowReportDTO
} from '@finance-command-center/shared-types';

describe('Phase 16 Reports & Analytics UI Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ReportHeader Component', () => {
    it('should render all 7 report tabs correctly', () => {
      const onTabChange = vi.fn();
      const onRefresh = vi.fn();

      render(
        <ReportHeader
          activeTab="summary"
          onTabChange={onTabChange}
          onRefresh={onRefresh}
          isLoading={false}
        />
      );

      expect(screen.getByText('Executive Summary')).toBeDefined();
      expect(screen.getByText('Portfolio Performance')).toBeDefined();
      expect(screen.getByText('Asset Allocation')).toBeDefined();
      expect(screen.getByText('Realized P&L')).toBeDefined();
      expect(screen.getByText('Digital Khata')).toBeDefined();
      expect(screen.getByText('IPO Participation')).toBeDefined();
      expect(screen.getByText('Alerts Analytics')).toBeDefined();
    });

    it('should call onTabChange when a tab is clicked', () => {
      const onTabChange = vi.fn();
      const { container } = render(
        <ReportHeader
          activeTab="summary"
          onTabChange={onTabChange}
          onRefresh={vi.fn()}
          isLoading={false}
        />
      );

      const buttons = Array.from(container.querySelectorAll('button'));
      const khataBtn = buttons.find((b) => b.textContent?.includes('Digital Khata'));
      expect(khataBtn).toBeDefined();
      fireEvent.click(khataBtn!);
      expect(onTabChange).toHaveBeenCalledWith('khata');
    });





  });

  describe('DateRangePicker Component', () => {
    it('should render preset selector and trigger onChange on selection', () => {
      const onChange = vi.fn();
      render(<DateRangePicker filter={{ preset: 'ALL_TIME' }} onChange={onChange} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDefined();

      fireEvent.change(select, { target: { value: 'CURRENT_MONTH' } });
      expect(onChange).toHaveBeenCalledWith({ preset: 'CURRENT_MONTH', timezone: 'Asia/Kolkata' });
    });
  });

  describe('PortfolioReportView Component', () => {
    it('should render performance metrics and asset allocation breakdown', () => {
      const mockPerformance: PortfolioPerformanceReportDTO = {
        portfolioId: undefined,
        portfolioName: 'All Portfolios',
        isMultiPortfolio: false,
        currentSnapshot: {
          totalMarketValue: '150000.0000',
          activeAcquisitionCost: '120000.0000',
          unrealizedPnL: '30000.0000',
          unrealizedPnLPercent: '25.00',
          holdingCount: 4,
          valuationCoverage: {
            totalHoldingsCount: 4,
            valuedHoldingsCount: 4,
            unvaluedHoldingsCount: 0,
            coveragePercentage: '100.0000',
            overallFreshness: 'LIVE'
          },
          overallFreshness: 'LIVE',
          valuationAsOf: '2026-09-22T08:00:00.000Z'
        },
        periodPerformance: {
          dateRange: {
            fromUtc: '2026-01-01T00:00:00.000Z',
            toUtc: '2026-12-31T23:59:59.999Z',
            preset: 'CURRENT_YEAR',
            timezone: 'Asia/Kolkata'
          },
          realizedPnL: '5000.0000',
          netCapitalInvested: '120000.0000',
          totalProceedsFromSales: '15000.0000',
          totalCapitalDeployed: '135000.0000',
          simpleReturnPercent: '29.17',
          xirrPercent: '18.45',
          xirrStatus: 'CALCULATED',
          cagrPercent: '15.20',
          cagrStatus: 'CALCULATED',
          cagrEligibilityReason: null
        },
        generatedAt: '2026-09-22T08:00:00.000Z'
      };

      const mockAllocation: AssetAllocationReportDTO = {
        totalMarketValue: '150000.0000',
        totalAcquisitionCost: '120000.0000',
        valuedHoldingsCount: 4,
        unvaluedHoldingsCount: 0,
        holdings: [
          {
            instrumentId: 'inst-1',
            symbol: 'RELIANCE',
            displayName: 'Reliance Industries',
            securityType: 'EQUITY',
            exchange: 'NSE',
            quantity: '50.0000',
            currentPrice: '2500.0000',
            marketValue: '125000.0000',
            acquisitionCost: '100000.0000',
            allocationPercent: '83.33',
            dataFreshness: 'LIVE'
          }
        ],
        breakdownBySecurityType: [
          {
            securityType: 'EQUITY',
            marketValue: '150000.0000',
            allocationPercent: '100.00',
            holdingCount: 4
          }
        ],
        overallFreshness: 'LIVE',
        generatedAt: '2026-09-22T08:00:00.000Z'
      };

      render(
        <PortfolioReportView
          performance={mockPerformance}
          allocation={mockAllocation}
          isLoading={false}
        />
      );

      expect(screen.getByText('Current Portfolio Snapshot')).toBeDefined();
      expect(screen.getByText('18.45%')).toBeDefined(); // XIRR
      expect(screen.getByText('15.20%')).toBeDefined(); // CAGR
      expect(screen.getByText('Holdings Allocation & Valuation')).toBeDefined();
      expect(screen.getByText('RELIANCE')).toBeDefined();
    });
  });

  describe('KhataReportView Component', () => {
    it('should render Khata cash flow metrics and transaction table', () => {
      const mockKhata: KhataCashFlowReportDTO = {
        dateRange: {
          fromUtc: '1970-01-01T00:00:00.000Z',
          toUtc: '2099-12-31T23:59:59.999Z',
          preset: 'ALL_TIME',
          timezone: 'Asia/Kolkata'
        },
        totalInflow: '25000.0000',
        totalOutflow: '10000.0000',
        netCashMovement: '15000.0000',
        totalReceivable: '5000.0000',
        totalPayable: '0.0000',
        netBalance: '20000.0000',
        accountSummaries: [
          {
            accountId: 'acc-1',
            accountName: 'Vendor A',
            partyName: 'Suppliers Inc',
            totalInflow: '25000.0000',
            totalOutflow: '10000.0000',
            netMovement: '15000.0000',
            currentBalance: '20000.0000'
          }
        ],
        transactions: {
          items: [
            {
              id: 'tx-1',
              accountId: 'acc-1',
              accountName: 'Vendor A',
              type: 'MONEY_IN',
              amount: '5000.0000',
              runningBalance: '20000.0000',
              transactionDate: '2026-09-22T08:00:00.000Z',
              description: 'Payment received'
            }
          ],
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1
        },
        generatedAt: '2026-09-22T08:00:00.000Z'
      };

      render(<KhataReportView report={mockKhata} isLoading={false} />);

      expect(screen.getByText('Khata Account Activity Summaries')).toBeDefined();
      expect(screen.getAllByText('Vendor A').length).toBeGreaterThan(0);
      expect(screen.getByText('Payment received')).toBeDefined();
    });

  });

  describe('ReportsPage Functional Integration', () => {
    it('should render page container with default summary tab', async () => {
      vi.spyOn(global, 'fetch').mockImplementation((_url) => {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                portfolioCount: 1,
                totalMarketValue: '100000.0000',
                totalAcquisitionCost: '80000.0000',
                unrealizedPnL: '20000.0000',
                unrealizedPnLPercent: '25.00',
                realizedPnL: '5000.0000',
                totalPnL: '25000.0000',
                valuationCoverage: {
                  totalHoldingsCount: 2,
                  valuedHoldingsCount: 2,
                  unvaluedHoldingsCount: 0,
                  coveragePercentage: '100.0000',
                  overallFreshness: 'LIVE'
                },
                khataNetBalance: '15000.0000',
                khataReceivable: '5000.0000',
                khataPayable: '0.0000',
                activeIpoApplicationsCount: 1,
                allotmentSuccessRatePercent: '50.00',
                activeAlertRulesCount: 3,
                unreadNotificationsCount: 1,
                generatedAt: '2026-09-22T08:00:00.000Z',
                filter: { preset: 'ALL_TIME' }
              }
            })
        } as any);
      });

      render(<ReportsPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Portfolio Valuation')).toBeDefined();
      });
    });
  });
});
