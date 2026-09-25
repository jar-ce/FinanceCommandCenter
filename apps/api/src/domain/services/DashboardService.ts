import { Decimal } from 'decimal.js';
import { PnlService } from './PnlService.js';
import { PortfolioService } from './PortfolioService.js';
import { WatchlistService } from './WatchlistService.js';
import { IPOService } from './IPOService.js';
import { IPOApplicationService } from './IPOApplicationService.js';
import { KhataService } from './KhataService.js';
import { AlertService } from './AlertService.js';
import { NotificationService } from './NotificationService.js';
import {
  DashboardSummaryDTO,
  DashboardSection,
  DashboardHeaderTelemetry,
  DashboardPortfolioOverview,
  DashboardHoldingItem,
  DashboardWatchlistItem,
  DashboardIPOItem,
  DashboardKhataOverview,
  UnifiedActivityItem,
  MarketDataFreshness,
  IPOApplicationRecord,
  NotificationRecord
} from '@finance-command-center/shared-types';

export class DashboardService {
  constructor(
    private pnlService: PnlService,
    private portfolioService: PortfolioService,
    private watchlistService: WatchlistService,
    private ipoService: IPOService,
    private ipoAppService: IPOApplicationService,
    private khataService: KhataService,
    private alertService: AlertService,
    private notificationService: NotificationService
  ) {}

  async getDashboardSummary(userId: string): Promise<DashboardSummaryDTO> {
    // Parallel section execution using Promise.allSettled to isolate subsystem failures
    const [
      portfolioRes,
      watchlistRes,
      ipoRes,
      khataRes,
      alertsRes
    ] = await Promise.allSettled([
      this.fetchPortfolioSection(userId),
      this.fetchWatchlistSection(userId),
      this.fetchIPOSection(userId),
      this.fetchKhataSection(userId),
      this.fetchAlertsSection(userId)
    ]);

    const portfolioSection = portfolioRes.status === 'fulfilled'
      ? portfolioRes.value
      : { status: 'ERROR' as const, data: null, errorMessage: portfolioRes.reason?.message || 'Portfolio subsystem error' };

    const watchlistSection = watchlistRes.status === 'fulfilled'
      ? watchlistRes.value
      : { status: 'ERROR' as const, data: [], errorMessage: watchlistRes.reason?.message || 'Watchlist subsystem error' };

    const ipoSection = ipoRes.status === 'fulfilled'
      ? ipoRes.value
      : { status: 'ERROR' as const, data: { activeIpos: [], userApplications: [] }, errorMessage: ipoRes.reason?.message || 'IPO subsystem error' };

    const khataSection = khataRes.status === 'fulfilled'
      ? khataRes.value
      : { status: 'ERROR' as const, data: null, errorMessage: khataRes.reason?.message || 'Digital Khata subsystem error' };

    const alertsSection = alertsRes.status === 'fulfilled'
      ? alertsRes.value
      : { status: 'ERROR' as const, data: { activeRulesCount: 0, unreadCount: 0, recentNotifications: [] }, errorMessage: alertsRes.reason?.message || 'Alerts subsystem error' };

    // Extract Top Holdings
    const topHoldingsSection = await this.deriveTopHoldings(userId, portfolioSection);

    // Compute Activity Stream
    const activityStreamSection = this.fetchActivityStream(
      khataSection,
      ipoSection,
      alertsSection
    );

    // Compute Header Telemetry
    const headerTelemetrySection = this.deriveHeaderTelemetry(
      portfolioSection,
      khataSection,
      alertsSection
    );

    return {
      headerTelemetry: headerTelemetrySection,
      portfolioOverview: portfolioSection,
      topHoldings: topHoldingsSection,
      watchlistSummary: watchlistSection,
      ipoSummary: ipoSection,
      khataSummary: khataSection,
      alertsSummary: alertsSection,
      activityStream: activityStreamSection,
      generatedAt: new Date().toISOString()
    };
  }

  // --------------------------------------------------------------------------
  // PORTFOLIO SECTION & MULTI-PORTFOLIO AGGREGATION
  // --------------------------------------------------------------------------
  private async fetchPortfolioSection(userId: string): Promise<DashboardSection<DashboardPortfolioOverview>> {
    const portfolios = await this.portfolioService.getUserPortfolios(userId, false);
    if (!portfolios || portfolios.length === 0) {
      return {
        status: 'EMPTY',
        data: null
      };
    }

    // Single portfolio optimization
    if (portfolios.length === 1) {
      const summary = await this.pnlService.getPnLSummary(portfolios[0].id, userId);
      return {
        status: 'SUCCESS',
        data: {
          portfolioCount: 1,
          totalMarketValue: summary.totalMarketValue,
          totalAcquisitionCost: summary.totalAcquisitionCost,
          unrealizedPnL: summary.unrealizedPnL,
          unrealizedPnLPercent: new Decimal(summary.totalAcquisitionCost).isZero()
            ? '0.00'
            : new Decimal(summary.unrealizedPnL).dividedBy(summary.totalAcquisitionCost).times(100).toFixed(2),
          realizedPnL: summary.realizedPnL,
          totalPnL: summary.totalPnL,
          simpleReturnPercent: summary.returnMetrics.simpleReturnPercent,
          xirrPercent: summary.returnMetrics.xirrPercent,
          xirrStatus: summary.returnMetrics.xirrStatus,
          valuationCoveragePercentage: summary.valuationCoverage.coveragePercentage,
          overallFreshness: summary.valuationCoverage.overallFreshness,
          valuationPartial: summary.valuationCoverage.coveragePercentage !== '100.0000'
        }
      };
    }

    // Multi-Portfolio Monetary Aggregation via Decimal.js
    let aggMarketValue = new Decimal(0);
    let aggAcquisitionCost = new Decimal(0);
    let aggRealizedPnL = new Decimal(0);
    let aggUnrealizedPnL = new Decimal(0);
    let aggTotalPnL = new Decimal(0);

    let totalHoldingsCountSum = 0;
    let valuedHoldingsCountSum = 0;
    const freshnessList: MarketDataFreshness[] = [];

    const portfolioResults = await Promise.all(
      portfolios.map((p) =>
        this.pnlService.getPnLSummary(p.id, userId).catch(() => null)
      )
    );

    for (const summary of portfolioResults) {
      if (!summary) continue;
      aggMarketValue = aggMarketValue.plus(summary.totalMarketValue);
      aggAcquisitionCost = aggAcquisitionCost.plus(summary.totalAcquisitionCost);
      aggRealizedPnL = aggRealizedPnL.plus(summary.realizedPnL);
      aggUnrealizedPnL = aggUnrealizedPnL.plus(summary.unrealizedPnL);
      aggTotalPnL = aggTotalPnL.plus(summary.totalPnL);

      totalHoldingsCountSum += summary.valuationCoverage.totalHoldingsCount;
      valuedHoldingsCountSum += summary.valuationCoverage.valuedHoldingsCount;
      freshnessList.push(summary.valuationCoverage.overallFreshness);
    }

    // Simple Return % = (Total Realized PnL + Total Unrealized PnL) / Total Acquisition Cost
    let simpleReturnPercent: string | null = null;
    if (!aggAcquisitionCost.isZero()) {
      simpleReturnPercent = aggTotalPnL.dividedBy(aggAcquisitionCost).times(100).toFixed(4);
    }

    const unrealizedPnLPercent = aggAcquisitionCost.isZero()
      ? '0.0000'
      : aggUnrealizedPnL.dividedBy(aggAcquisitionCost).times(100).toFixed(4);

    const aggCoveragePercent = totalHoldingsCountSum === 0
      ? '100.0000'
      : new Decimal(valuedHoldingsCountSum).dividedBy(totalHoldingsCountSum).times(100).toFixed(4);

    const overallFreshness = this.aggregateFreshness(freshnessList);

    return {
      status: 'SUCCESS',
      data: {
        portfolioCount: portfolios.length,
        totalMarketValue: aggMarketValue.toFixed(4),
        totalAcquisitionCost: aggAcquisitionCost.toFixed(4),
        unrealizedPnL: aggUnrealizedPnL.toFixed(4),
        unrealizedPnLPercent,
        realizedPnL: aggRealizedPnL.toFixed(4),
        totalPnL: aggTotalPnL.toFixed(4),
        simpleReturnPercent,
        xirrPercent: null, // Strict Requirement: Multi-Portfolio XIRR must be null
        xirrStatus: 'UNAVAILABLE',
        valuationCoveragePercentage: aggCoveragePercent,
        overallFreshness,
        valuationPartial: aggCoveragePercent !== '100.0000'
      }
    };
  }

  // --------------------------------------------------------------------------
  // TOP HOLDINGS SECTION
  // --------------------------------------------------------------------------
  private async deriveTopHoldings(
    userId: string,
    portfolioSection: DashboardSection<DashboardPortfolioOverview>
  ): Promise<DashboardSection<DashboardHoldingItem[]>> {
    if (portfolioSection.status !== 'SUCCESS' || !portfolioSection.data) {
      return { status: portfolioSection.status, data: null, errorMessage: portfolioSection.errorMessage };
    }

    const allHoldings = await this.fetchTopHoldingsDirect(userId);
    return { status: allHoldings.length === 0 ? 'EMPTY' : 'SUCCESS', data: allHoldings };
  }

  private async fetchTopHoldingsDirect(userId: string): Promise<DashboardHoldingItem[]> {
    const portfolios = await this.portfolioService.getUserPortfolios(userId, false);
    if (!portfolios || portfolios.length === 0) return [];

    const allHoldings: DashboardHoldingItem[] = [];
    for (const p of portfolios) {
      try {
        const holdings = await this.pnlService.getHoldingPnL(p.id, userId);
        for (const h of holdings) {
          allHoldings.push({
            instrumentId: h.instrumentId,
            symbol: h.symbol,
            displayName: h.displayName,
            quantity: h.quantity,
            averageCost: h.averageCost || '0.0000',
            currentPrice: h.currentPrice || '0.0000',
            marketValue: h.marketValue || '0.0000',
            unrealizedPnL: h.unrealizedPnL || '0.0000',
            unrealizedPnLPercent: h.unrealizedPnLPercent || '0.00',
            dailyMarketChangePercent: null,
            dataFreshness: h.dataFreshness
          });
        }
      } catch {
        // Skip
      }
    }

    // Sort by marketValue descending and take top 5
    allHoldings.sort((a, b) => new Decimal(b.marketValue).minus(a.marketValue).toNumber());
    return allHoldings.slice(0, 5);
  }

  // --------------------------------------------------------------------------
  // WATCHLIST SECTION
  // --------------------------------------------------------------------------
  private async fetchWatchlistSection(userId: string): Promise<DashboardSection<DashboardWatchlistItem[]>> {
    const watchlists = await this.watchlistService.getUserWatchlists(userId, false);
    if (!watchlists || watchlists.length === 0) {
      return { status: 'EMPTY', data: [] };
    }

    const primaryWatchlist = watchlists[0];
    const details = await this.watchlistService.getWatchlistDetails(primaryWatchlist.id, userId);
    if (!details || !details.items || details.items.length === 0) {
      return { status: 'EMPTY', data: [] };
    }

    const topItems: DashboardWatchlistItem[] = details.items.slice(0, 5).map((item) => ({
      id: item.id,
      watchlistId: primaryWatchlist.id,
      watchlistName: primaryWatchlist.name,
      instrumentId: item.instrumentId,
      symbol: item.instrument?.symbol || item.id,
      displayName: item.instrument?.displayName || 'Instrument',
      currentPrice: item.quote?.lastPrice || null,
      dailyMarketChangePercent: item.quote?.changePercent || null,
      dataFreshness: item.quote?.dataFreshness || 'UNAVAILABLE'
    }));

    return { status: 'SUCCESS', data: topItems };
  }

  // --------------------------------------------------------------------------
  // IPO SECTION
  // --------------------------------------------------------------------------
  private async fetchIPOSection(userId: string): Promise<DashboardSection<{ activeIpos: DashboardIPOItem[]; userApplications: IPOApplicationRecord[] }>> {
    const now = new Date();
    const { ipos } = await this.ipoService.listIPOs({ status: 'OPEN', limit: 5 });
    const { applications } = await this.ipoAppService.listApplications({ userId, limit: 5 });

    const activeItems: DashboardIPOItem[] = ipos.map((ipo) => {
      let closingSoon = false;
      if (ipo.closeDate && ipo.status === 'OPEN') {
        const closeTime = new Date(ipo.closeDate).getTime();
        const diffHours = (closeTime - now.getTime()) / (1000 * 3600);
        closingSoon = diffHours > 0 && diffHours <= 24;
      }

      return {
        id: ipo.id,
        ipoName: ipo.ipoName,
        issuerName: ipo.issuerName,
        symbol: ipo.symbol || null,
        status: ipo.status as any,
        openDate: ipo.openDate ? new Date(ipo.openDate).toISOString() : null,
        closeDate: ipo.closeDate ? new Date(ipo.closeDate).toISOString() : null,
        closingSoon,
        priceBandLow: ipo.priceBandLow || null,
        priceBandHigh: ipo.priceBandHigh || null
      };
    });

    const formattedApplications: IPOApplicationRecord[] = applications.map((app) => ({
      ...app,
      status: app.status as any,
      applicationDate: typeof app.applicationDate === 'string'
        ? app.applicationDate
        : new Date(app.applicationDate).toISOString(),
      createdAt: typeof (app as any).createdAt === 'string'
        ? (app as any).createdAt
        : new Date((app as any).createdAt).toISOString(),
      updatedAt: typeof (app as any).updatedAt === 'string'
        ? (app as any).updatedAt
        : new Date((app as any).updatedAt).toISOString()
    }));

    const isEmpty = activeItems.length === 0 && formattedApplications.length === 0;

    return {
      status: isEmpty ? 'EMPTY' : 'SUCCESS',
      data: {
        activeIpos: activeItems,
        userApplications: formattedApplications
      }
    };
  }

  // --------------------------------------------------------------------------
  // KHATA SECTION
  // --------------------------------------------------------------------------
  private async fetchKhataSection(userId: string): Promise<DashboardSection<DashboardKhataOverview>> {
    const { accounts, summary } = await this.khataService.listAccounts({ userId });
    if (!accounts || accounts.length === 0) {
      return { status: 'EMPTY', data: null };
    }

    const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE');
    const recentTxList: DashboardKhataOverview['recentTransactions'] = [];

    // Fetch recent ledger transactions
    for (const acc of activeAccounts.slice(0, 3)) {
      try {
        const ledger = await this.khataService.getAccountLedger({ accountId: acc.id, userId, limit: 3 });
        for (const tx of ledger.transactions) {
          recentTxList.push({
            id: tx.id,
            accountId: acc.id,
            accountName: acc.displayName,
            type: tx.type as 'MONEY_IN' | 'MONEY_OUT',
            amount: tx.amount,
            runningBalance: tx.runningBalance,
            transactionDate: typeof tx.transactionDate === 'string'
              ? tx.transactionDate
              : new Date(tx.transactionDate).toISOString(),
            description: tx.description
          });
        }
      } catch {
        // Skip
      }
    }

    recentTxList.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

    return {
      status: 'SUCCESS',
      data: {
        totalNetBalance: summary.netBalance,
        totalReceivable: summary.totalReceivable,
        totalPayable: summary.totalPayable,
        activeAccountsCount: activeAccounts.length,
        recentTransactions: recentTxList.slice(0, 5)
      }
    };
  }

  // --------------------------------------------------------------------------
  // ALERTS & NOTIFICATIONS SECTION
  // --------------------------------------------------------------------------
  private async fetchAlertsSection(userId: string): Promise<DashboardSection<{ activeRulesCount: number; unreadCount: number; recentNotifications: NotificationRecord[] }>> {
    const activeRules = await this.alertService.getUserAlertRules(userId, 'ACTIVE');
    const unreadCount = await this.notificationService.getUnreadCount(userId);
    const { items: recentNotifications } = await this.notificationService.getUserNotifications(userId, 'UNREAD', 5);

    return {
      status: 'SUCCESS',
      data: {
        activeRulesCount: activeRules.length,
        unreadCount,
        recentNotifications
      }
    };
  }

  // --------------------------------------------------------------------------
  // UNIFIED ACTIVITY STREAM (IN-MEMORY AGGREGATION FROM REAL DOMAIN RECORDS)
  // --------------------------------------------------------------------------
  private fetchActivityStream(
    khataSection: DashboardSection<DashboardKhataOverview>,
    ipoSection: DashboardSection<{ activeIpos: DashboardIPOItem[]; userApplications: IPOApplicationRecord[] }>,
    alertsSection: DashboardSection<{ activeRulesCount: number; unreadCount: number; recentNotifications: NotificationRecord[] }>
  ): DashboardSection<UnifiedActivityItem[]> {
    const items: UnifiedActivityItem[] = [];

    // 1. Khata events
    if (khataSection.data && khataSection.data.recentTransactions) {
      for (const tx of khataSection.data.recentTransactions) {
        items.push({
          id: `act-khata-${tx.id}`,
          category: 'KHATA',
          title: `Khata ${tx.type === 'MONEY_IN' ? 'Money In' : 'Money Out'}: ₹${tx.amount}`,
          description: `${tx.accountName}: ${tx.description}`,
          timestamp: tx.transactionDate,
          referenceId: tx.id
        });
      }
    }

    // 2. IPO events
    if (ipoSection.data && ipoSection.data.userApplications) {
      for (const app of ipoSection.data.userApplications) {
        items.push({
          id: `act-ipo-${app.id}`,
          category: 'IPO',
          title: `IPO Application ${app.status}`,
          description: `Applied for ${app.quantityApplied} shares (Amount: ₹${app.applicationAmount})`,
          timestamp: app.applicationDate,
          referenceId: app.id
        });
      }
    }

    // 3. Notification events
    if (alertsSection.data && alertsSection.data.recentNotifications) {
      for (const notif of alertsSection.data.recentNotifications) {
        items.push({
          id: `act-notif-${notif.id}`,
          category: 'NOTIFICATION',
          title: notif.title,
          description: notif.message,
          timestamp: notif.createdAt,
          referenceId: notif.id
        });
      }
    }

    // Sort deterministically by timestamp DESC and take top 10
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const top10 = items.slice(0, 10);

    return {
      status: top10.length === 0 ? 'EMPTY' : 'SUCCESS',
      data: top10
    };
  }

  // --------------------------------------------------------------------------
  // HEADER TELEMETRY & FRESHNESS SEVERITY AGGREGATION
  // --------------------------------------------------------------------------
  private deriveHeaderTelemetry(
    portfolioSection: DashboardSection<DashboardPortfolioOverview>,
    khataSection: DashboardSection<DashboardKhataOverview>,
    alertsSection: DashboardSection<{ activeRulesCount: number; unreadCount: number; recentNotifications: NotificationRecord[] }>
  ): DashboardSection<DashboardHeaderTelemetry> {
    const portfolioMarketValue = portfolioSection.data?.totalMarketValue || '0.0000';
    const totalRealizedPnL = portfolioSection.data?.realizedPnL || '0.0000';
    const totalUnrealizedPnL = portfolioSection.data?.unrealizedPnL || '0.0000';
    const totalPnL = portfolioSection.data?.totalPnL || '0.0000';
    const khataNetBalance = khataSection.data?.totalNetBalance || '0.0000';
    const unreadNotificationsCount = alertsSection.data?.unreadCount || 0;
    const activeAlertRulesCount = alertsSection.data?.activeRulesCount || 0;
    const overallFreshness = portfolioSection.data?.overallFreshness || 'UNAVAILABLE';
    const valuationPartial = portfolioSection.data?.valuationPartial || false;

    return {
      status: 'SUCCESS',
      data: {
        portfolioMarketValue,
        dailyMarketChangePercent: null,
        totalRealizedPnL,
        totalUnrealizedPnL,
        totalPnL,
        khataNetBalance,
        unreadNotificationsCount,
        activeAlertRulesCount,
        overallFreshness,
        valuationPartial
      }
    };
  }

  private aggregateFreshness(list: MarketDataFreshness[]): MarketDataFreshness {
    if (list.length === 0) return 'UNAVAILABLE';
    if (list.includes('UNAVAILABLE')) return 'UNAVAILABLE';
    if (list.includes('STALE')) return 'STALE';
    if (list.includes('EOD')) return 'EOD';
    if (list.includes('DELAYED')) return 'DELAYED';
    return 'LIVE';
  }
}
