/**
 * FINANCE COMMAND CENTER (APEX OS)
 * Shared Architectural Type Definitions & Contracts
 */

import { Decimal } from 'decimal.js';

// ==========================================
// 1. FINANCIAL PRECISION & ARITHMETIC TYPES
// ==========================================

export type DecimalValue = Decimal | string | number;

export interface FinancialPrecisionConfig {
  readonly maxIntegerDigits: number; // 14
  readonly decimalPlaces: number;    // 4
  readonly roundingMode: 'ROUND_HALF_UP';
}

export interface MonetaryValue {
  readonly amount: string; // Serialized string representation of NUMERIC(18, 4)
  readonly currency: 'INR';
}

// ==========================================
// 2. MARKET DATA PROVIDER ABSTRACTION CONTRACTS
// ==========================================

export type MarketExchange = 'NSE' | 'BSE' | 'NASDAQ' | 'NYSE' | 'GLOBAL';
export type MarketSecurityType = 'EQUITY' | 'ETF' | 'INDEX' | 'MUTUAL_FUND' | 'BOND' | 'OTHER';
export type MarketInstrumentStatus = 'ACTIVE' | 'INACTIVE' | 'DELISTED' | 'SUSPENDED';
export type MarketProviderStatus = 
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'AUTH_REQUIRED'
  | 'PROVIDER_ERROR'
  | 'INVALID_RESPONSE'
  | 'STALE';
export type MarketDataFreshness = 'LIVE' | 'DELAYED' | 'EOD' | 'STALE' | 'UNAVAILABLE';
export type MarketState = 'OPEN' | 'CLOSED' | 'PRE_OPEN' | 'POST_CLOSE' | 'HALTED' | 'UNKNOWN';
export type HistoricalAdjustmentStatus = 'RAW' | 'ADJUSTED' | 'UNKNOWN';

export interface MarketInstrumentRecord {
  readonly id: string;
  readonly symbol: string;
  readonly displayName: string;
  readonly exchange: MarketExchange;
  readonly market: string;
  readonly securityType: MarketSecurityType;
  readonly currency: string;
  readonly provider: string;
  readonly providerInstrumentId?: string | null;
  readonly status: MarketInstrumentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MarketQuoteRecord {
  readonly id: string;
  readonly instrumentId: string;
  readonly lastPrice: string | null; // Serialized NUMERIC(18, 4)
  readonly previousClose: string | null; // Serialized NUMERIC(18, 4)
  readonly open: string | null;
  readonly high: string | null;
  readonly low: string | null;
  readonly close: string | null;
  readonly volume: number;
  readonly change: string; // Calculated via Decimal.js: lastPrice - previousClose
  readonly changePercent: string; // Calculated via Decimal.js: ((lastPrice - previousClose) / previousClose) * 100
  readonly currency: string;
  readonly marketStatus: MarketState;
  readonly dataFreshness: MarketDataFreshness;
  readonly asOf?: string | null;
  readonly retrievedAt: string;
  readonly provider: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  // Joined metadata
  readonly symbol?: string;
  readonly displayName?: string;
  readonly exchange?: MarketExchange;
}

export interface MarketCandle {
  readonly timestamp: string;
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  readonly volume: number;
  readonly interval: string; // '1D', '1W', '1M', '1Y'
  readonly adjustmentStatus: HistoricalAdjustmentStatus;
}

export interface MarketSearchFilters {
  readonly query?: string;
  readonly exchange?: MarketExchange;
  readonly securityType?: MarketSecurityType;
  readonly status?: MarketInstrumentStatus;
  readonly page?: number;
  readonly limit?: number;
}

// Deprecated alias interfaces for backwards-compatibility
export type StockQuote = MarketQuoteRecord;
export type CandleData = MarketCandle;
export interface SymbolSearchResult {
  readonly symbol: string;
  readonly name: string;
  readonly exchange: MarketExchange;
  readonly type: MarketSecurityType;
}
export interface MarketStatus {
  readonly exchange: MarketExchange;
  readonly isOpen: boolean;
  readonly marketState: MarketState;
  readonly lastUpdated: string;
}

export interface IMarketDataProviderContract {
  readonly providerId: string;
  readonly providerName: string;
  searchInstruments(query: string, filters?: Partial<MarketSearchFilters>): Promise<{ status: MarketProviderStatus; data: MarketInstrumentRecord[] }>;
  getInstrument(symbolOrId: string, exchange?: MarketExchange): Promise<{ status: MarketProviderStatus; data: MarketInstrumentRecord | null }>;
  getQuote(symbolOrId: string, exchange?: MarketExchange): Promise<{ status: MarketProviderStatus; data: MarketQuoteRecord | null }>;
  getBatchQuotes(symbolsOrIds: string[]): Promise<{ status: MarketProviderStatus; data: Map<string, MarketQuoteRecord> }>;
  getHistoricalPrices(symbolOrId: string, interval: string, range?: string): Promise<{ status: MarketProviderStatus; data: MarketCandle[] }>;
  getMarketStatus(exchange?: MarketExchange): Promise<{ status: MarketProviderStatus; data: MarketStatus }>;
}

// ==========================================
// 3. IPO & ALLOTMENT PROVIDER CONTRACTS
// ==========================================

export type IPOStatus = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'LISTED' | 'CANCELLED' | 'POSTPONED';
export type IPOExchange = 'NSE' | 'BSE' | 'NSE_BSE' | 'UNKNOWN';
export type IPOIssueType = 'MAINBOARD' | 'SME' | 'UNKNOWN';

export interface IPOMasterRecord {
  readonly id: string;
  readonly externalId?: string | null;
  readonly provider: string;
  readonly source: string;
  readonly issuerName: string;
  readonly ipoName: string;
  readonly symbol?: string | null;
  readonly exchange: IPOExchange;
  readonly securityType: string;
  readonly issueType: IPOIssueType;
  readonly status: IPOStatus;
  readonly openDate?: string | null;
  readonly closeDate?: string | null;
  readonly listingDate?: string | null;
  readonly faceValue?: string | null;
  readonly priceBandLow?: string | null;
  readonly priceBandHigh?: string | null;
  readonly lotSize?: number | null;
  readonly maxLotCost?: string | null; // Derived via Decimal.js: priceBandHigh * lotSize
  readonly issueSize?: string | null;
  readonly freshIssueSize?: string | null;
  readonly offerForSaleSize?: string | null;
  readonly retrievedAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IPOPipelineSummary {
  readonly upcoming: number;
  readonly open: number;
  readonly closed: number;
  readonly listed: number;
  readonly total: number;
}

export interface IPOCatalogItem {
  readonly id: string;
  readonly companyName: string;
  readonly symbol?: string;
  readonly category: IPOIssueType;
  readonly status: IPOStatus;
  readonly priceBandMin: string;
  readonly priceBandMax: string;
  readonly lotSize: number;
  readonly issueSize: string;
  readonly openDate: string;
  readonly closeDate: string;
  readonly allotmentDate?: string;
  readonly listingDate?: string;
  readonly registrarName: string;
  readonly registrarWebsite?: string;
  readonly source: string;
  readonly lastUpdated: string;
}

export type AllotmentStatus = 'ALLOTTED' | 'NOT_ALLOTTED' | 'UNDER_PROCESS' | 'MANUAL_VERIFICATION_REQUIRED';

export interface IPOAllotmentResult {
  readonly applicationNumber: string;
  readonly panNumber?: string;
  readonly status: AllotmentStatus;
  readonly sharesAllotted?: number;
  readonly refundAmount?: string;
  readonly registrarName: string;
  readonly externalVerificationUrl?: string; // Guided manual link for CAPTCHA/OTP portals
  readonly verifiedAt: string;
}

export interface IIPODataProviderContract {
  readonly providerId: string;
  getIPOCatalog(): Promise<IPOCatalogItem[]>;
  getIPODetails(id: string): Promise<IPOCatalogItem | null>;
  checkAllotmentStatus(params: { applicationNumber: string; panNumber?: string; registrarId: string }): Promise<IPOAllotmentResult>;
}

// ==========================================
// 3.1 IPO APPLICATION TRACKER TYPES (PHASE 7)
// ==========================================

export type IPOApplicationStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'COMPLETED'  // Note: COMPLETED means payment/application workflow completed, NOT allotted
  | 'CANCELLED';

export interface IPOApplicationRecord {
  readonly id: string;
  readonly userId: string;
  readonly ipoId: string;
  readonly applicationAccountId: string;
  readonly applicationDate: string; // ISO String
  readonly lotsApplied: number;
  readonly quantityApplied: number;
  readonly applicationAmount: string; // Serialized NUMERIC(18, 4)
  readonly estimatedAmount?: string | null; // Calculated reference: priceBandHigh * quantityApplied
  readonly status: IPOApplicationStatus;
  readonly paymentReference?: string | null;
  readonly notes?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  // Joined display attributes
  readonly ipoName?: string;
  readonly issuerName?: string;
  readonly symbol?: string | null;
  readonly accountDisplayName?: string;
}

export interface IPOApplicationSummary {
  readonly total: number;
  readonly draft: number;
  readonly submitted: number;
  readonly paymentPending: number;
  readonly paymentConfirmed: number;
  readonly completed: number;
  readonly cancelled: number;
}

export interface CreateIPOApplicationDTO {
  readonly ipoId: string;
  readonly applicationAccountId: string;
  readonly applicationDate: string;
  readonly lotsApplied: number;
  readonly quantityApplied?: number;
  readonly applicationAmount?: string; // Optional user override, defaults to priceBandHigh * quantityApplied
  readonly paymentReference?: string;
  readonly notes?: string;
}

export interface UpdateIPOApplicationDTO {
  readonly paymentReference?: string;
  readonly notes?: string;
}

// ==========================================
// 3.2 IPO ALLOTMENT CHECKER TYPES (PHASE 8)
// ==========================================

export type IPOAllotmentDomainStatus =
  | 'UNKNOWN'
  | 'PENDING'
  | 'ALLOTTED'
  | 'PARTIALLY_ALLOTTED'
  | 'NOT_ALLOTTED'
  | 'REJECTED';

export type IPOAllotmentVerificationStatus =
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'MANUAL_REQUIRED';

export type IPOAllotmentVerificationMethod =
  | 'PROVIDER_API'
  | 'PUBLIC_OFFICIAL'
  | 'MANUAL';

export interface IPOAllotmentResultRecord {
  readonly id: string;
  readonly userId: string;
  readonly applicationId: string;
  readonly allotmentStatus: IPOAllotmentDomainStatus;
  readonly verificationStatus: IPOAllotmentVerificationStatus;
  readonly verificationMethod: IPOAllotmentVerificationMethod;
  readonly appliedQuantity: number;
  readonly allottedQuantity: number;
  readonly allotmentRatio?: string | null;
  readonly provider: string;
  readonly source: string;
  readonly externalReference?: string | null;
  readonly retrievedAt?: string | null;
  readonly verifiedAt?: string | null;
  readonly notes?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  // Joined display attributes
  readonly ipoName?: string;
  readonly issuerName?: string;
  readonly symbol?: string | null;
  readonly applicationDate?: string;
  readonly accountDisplayName?: string;
  readonly maskedApplicationNumber?: string | null;
}

export interface IPOAllotmentSummary {
  readonly total: number;
  readonly verified: number;
  readonly unverified: number;
  readonly stale: number;
  readonly manualRequired: number;
  readonly unavailable: number;
  readonly allottedCount: number;
  readonly partiallyAllottedCount: number;
  readonly notAllottedCount: number;
}

export interface ManualVerifyAllotmentDTO {
  readonly allotmentStatus: IPOAllotmentDomainStatus;
  readonly allottedQuantity: number;
  readonly notes?: string;
  readonly source?: string;
}

// ==========================================
// 3.3 WATCHLIST TYPES (PHASE 11)
// ==========================================

export type WatchlistStatus = 'ACTIVE' | 'ARCHIVED';

export interface WatchlistRecord {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly status: WatchlistStatus;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string | null;
  readonly itemCount?: number;
}

export interface WatchlistItemRecord {
  readonly id: string;
  readonly watchlistId: string;
  readonly instrumentId: string;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  // Joined market instrument & quote reference data
  readonly instrument?: MarketInstrumentRecord;
  readonly quote?: MarketQuoteRecord;
}

export interface WatchlistWithItemsRecord extends WatchlistRecord {
  readonly items: WatchlistItemRecord[];
}

export interface CreateWatchlistDTO {
  readonly name: string;
  readonly description?: string;
}

export interface UpdateWatchlistDTO {
  readonly name?: string;
  readonly description?: string;
}

export interface AddWatchlistItemDTO {
  readonly instrumentId: string;
}

export interface ReorderWatchlistItemsDTO {
  readonly itemIds: string[];
}

// ==========================================
// 3.4 PORTFOLIO & HOLDINGS TYPES (PHASE 12)
// ==========================================

export type PortfolioStatus = 'ACTIVE' | 'ARCHIVED';
export type PortfolioTransactionType = 'BUY' | 'SELL';

export interface PortfolioRecord {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly status: PortfolioStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string | null;
  readonly holdingCount?: number;
}

export interface PortfolioTransactionRecord {
  readonly id: string;
  readonly portfolioId: string;
  readonly instrumentId: string;
  readonly transactionType: PortfolioTransactionType;
  readonly transactionDate: string; // ISO String
  readonly quantity: string; // Serialized NUMERIC(18, 4)
  readonly price: string; // Serialized NUMERIC(18, 4)
  readonly grossAmount: string; // Serialized NUMERIC(18, 4)
  readonly charges: string; // Serialized NUMERIC(18, 4)
  readonly taxes: string; // Serialized NUMERIC(18, 4)
  readonly totalAmount: string; // Serialized NUMERIC(18, 4)
  readonly externalReference?: string | null;
  readonly notes?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  // Joined attributes
  readonly symbol?: string;
  readonly displayName?: string;
  readonly exchange?: MarketExchange;
}

export interface PortfolioHoldingRecord {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly displayName: string;
  readonly exchange: MarketExchange;
  readonly market: string;
  readonly securityType: MarketSecurityType;
  readonly currency: string;
  readonly quantity: string; // Serialized NUMERIC(18, 4)
  readonly averageCost: string; // Serialized NUMERIC(18, 4)
  readonly totalAcquisitionCost: string; // Serialized NUMERIC(18, 4)
  readonly currentPrice: string | null; // Serialized NUMERIC(18, 4)
  readonly marketValue: string | null; // Serialized NUMERIC(18, 4)
  readonly unrealizedGainLoss: string | null; // Basic display-level holding metric: marketValue - totalAcquisitionCost
  readonly unrealizedGainLossPercent: string | null; // Basic display-level holding metric percentage
  readonly marketStatus: MarketState;
  readonly dataFreshness: MarketDataFreshness;
  readonly asOf?: string | null;
}

export interface PortfolioWithHoldingsRecord extends PortfolioRecord {
  readonly holdings: PortfolioHoldingRecord[];
}

export interface CreatePortfolioDTO {
  readonly name: string;
  readonly description?: string;
}

export interface UpdatePortfolioDTO {
  readonly name?: string;
  readonly description?: string;
}

export interface CreatePortfolioTransactionDTO {
  readonly instrumentId: string;
  readonly transactionType: PortfolioTransactionType;
  readonly transactionDate: string;
  readonly quantity: string;
  readonly price: string;
  readonly charges?: string;
  readonly taxes?: string;
  readonly externalReference?: string;
  readonly notes?: string;
}

// ==========================================
// 3.5 P&L & PORTFOLIO ANALYTICS TYPES (PHASE 13)
// ==========================================

export interface ValuationCoverageRecord {
  readonly totalHoldingsCount: number;
  readonly valuedHoldingsCount: number;
  readonly unvaluedHoldingsCount: number;
  readonly coveragePercentage: string;
  readonly overallFreshness: MarketDataFreshness;
}

export interface ReturnMetricsRecord {
  readonly simpleReturnPercent: string | null;
  readonly xirrPercent: string | null;
  readonly xirrStatus: 'CALCULATED' | 'UNAVAILABLE';
  readonly cagrPercent: string | null;
  readonly cagrStatus: 'CALCULATED' | 'UNAVAILABLE';
  readonly valuationAsOf: string | null;
  readonly calculatedAt: string;
  readonly message?: string | null;
}

export interface PnLSummaryRecord {
  readonly portfolioId: string;
  readonly realizedPnL: string;
  readonly unrealizedPnL: string;
  readonly totalPnL: string;
  readonly totalAcquisitionCost: string;
  readonly totalMarketValue: string;
  readonly valuationCoverage: ValuationCoverageRecord;
  readonly returnMetrics: ReturnMetricsRecord;
  readonly valuationAsOf: string | null;
  readonly calculatedAt: string;
  readonly asOf: string;
}

export interface HoldingPnLRecord {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly displayName: string;
  readonly exchange: MarketExchange;
  readonly market: string;
  readonly securityType: MarketSecurityType;
  readonly currency: string;
  readonly quantity: string;
  readonly averageCost: string;
  readonly totalAcquisitionCost: string;
  readonly currentPrice: string | null;
  readonly marketValue: string | null;
  readonly unrealizedPnL: string | null;
  readonly unrealizedPnLPercent: string | null;
  readonly realizedPnL: string;
  readonly totalPnL: string | null;
  readonly marketStatus: MarketState;
  readonly dataFreshness: MarketDataFreshness;
  readonly asOf: string | null;
}

export interface RealizedPnLRecord {
  readonly transactionId: string;
  readonly portfolioId: string;
  readonly instrumentId: string;
  readonly symbol: string;
  readonly displayName: string;
  readonly exchange: MarketExchange;
  readonly transactionDate: string;
  readonly soldQuantity: string;
  readonly price: string;
  readonly grossProceeds: string;
  readonly charges: string;
  readonly taxes: string;
  readonly netProceeds: string;
  readonly averageCostBeforeSell: string;
  readonly costRemoved: string;
  readonly realizedPnL: string;
}

export interface PnLTimeRangeFilter {
  readonly fromDate?: string;
  readonly toDate?: string;
}

// ==========================================
// 3.6 ALERTS & NOTIFICATIONS TYPES (PHASE 14)
// ==========================================

export type AlertType =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'PRICE_CHANGE_PERCENT_ABOVE'
  | 'PRICE_CHANGE_PERCENT_BELOW'
  | 'VOLUME_ABOVE'
  | 'PORTFOLIO_TOTAL_PNL_ABOVE'
  | 'PORTFOLIO_TOTAL_PNL_BELOW'
  | 'PORTFOLIO_UNREALIZED_PNL_PERCENT_ABOVE'
  | 'PORTFOLIO_UNREALIZED_PNL_PERCENT_BELOW'
  | 'IPO_OPENING'
  | 'IPO_CLOSING_SOON';

export type AlertTargetType = 'MARKET_INSTRUMENT' | 'PORTFOLIO' | 'IPO';
export type AlertConditionOperator = 'GTE' | 'LTE' | 'EQ' | 'STATE_CHANGE';
export type AlertRuleStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type AlertEvaluationState = 'BELOW' | 'ABOVE' | 'EQUAL' | 'UNKNOWN';
export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED';
export type NotificationType = 'MARKET_ALERT' | 'PORTFOLIO_ALERT' | 'IPO_ALERT';

export interface AlertRuleRecord {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly alertType: AlertType;
  readonly targetType: AlertTargetType;
  readonly targetId: string;
  readonly conditionOperator: AlertConditionOperator;
  readonly thresholdValue?: string | null;
  readonly thresholdPercent?: string | null;
  readonly cooldownMinutes: number;
  readonly status: AlertRuleStatus;
  readonly lastTriggeredAt?: string | null;
  readonly lastEvaluatedAt?: string | null;
  readonly lastEvaluatedValue?: string | null;
  readonly lastEvaluatedState: AlertEvaluationState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string | null;
  // Joined target metadata
  readonly targetName?: string;
  readonly targetSymbol?: string | null;
}

export interface AlertEventRecord {
  readonly id: string;
  readonly alertRuleId: string;
  readonly userId: string;
  readonly triggeredAt: string;
  readonly triggerValue?: string | null; // Nullable for state alerts like IPO_OPENING
  readonly thresholdValue?: string | null; // Nullable for state alerts like IPO_OPENING
  readonly evaluationSnapshot?: Record<string, unknown> | null;
  readonly deduplicationKey: string;
  readonly createdAt: string;
}

export interface NotificationRecord {
  readonly id: string;
  readonly userId: string;
  readonly alertEventId: string;
  readonly alertRuleId: string;
  readonly notificationType: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly status: NotificationStatus;
  readonly readAt?: string | null;
  readonly createdAt: string;
  // Joined metadata
  readonly alertName?: string;
}

export interface CreateAlertRuleDTO {
  readonly name: string;
  readonly description?: string;
  readonly alertType: AlertType;
  readonly targetType: AlertTargetType;
  readonly targetId: string;
  readonly conditionOperator?: AlertConditionOperator;
  readonly thresholdValue?: string;
  readonly thresholdPercent?: string;
  readonly cooldownMinutes?: number;
}

export interface UpdateAlertRuleDTO {
  readonly name?: string;
  readonly description?: string;
  readonly thresholdValue?: string;
  readonly thresholdPercent?: string;
  readonly cooldownMinutes?: number;
}

export interface AlertEvaluationResult {
  readonly ruleId: string;
  readonly triggered: boolean;
  readonly reason?: string;
  readonly event?: AlertEventRecord;
  readonly notification?: NotificationRecord;
}

// ==========================================
// 4. API & TRANSPORT CONTRACTS
// ==========================================

export interface ApiResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly timestamp: string;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
  readonly timestamp: string;
}

export interface PaginationParams {
  readonly page: number;
  readonly limit: number;
}

export interface PaginatedResponse<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

// ==========================================
// 3.8 UNIFIED DASHBOARD TYPES (PHASE 15)
// ==========================================

export type DashboardSectionStatus = 'SUCCESS' | 'EMPTY' | 'UNAVAILABLE' | 'ERROR';

export interface DashboardSection<T> {
  readonly status: DashboardSectionStatus;
  readonly data: T | null;
  readonly errorMessage?: string;
}

export interface DashboardHeaderTelemetry {
  readonly portfolioMarketValue: string;
  readonly dailyMarketChangePercent: string | null;
  readonly totalRealizedPnL: string;
  readonly totalUnrealizedPnL: string;
  readonly totalPnL: string;
  readonly khataNetBalance: string;
  readonly unreadNotificationsCount: number;
  readonly activeAlertRulesCount: number;
  readonly overallFreshness: MarketDataFreshness;
  readonly valuationPartial: boolean;
}

export interface DashboardPortfolioOverview {
  readonly portfolioCount: number;
  readonly totalMarketValue: string;
  readonly totalAcquisitionCost: string;
  readonly unrealizedPnL: string;
  readonly unrealizedPnLPercent: string;
  readonly realizedPnL: string;
  readonly totalPnL: string;
  readonly simpleReturnPercent: string | null;
  readonly xirrPercent: string | null;
  readonly xirrStatus: 'CALCULATED' | 'UNAVAILABLE';
  readonly valuationCoveragePercentage: string;
  readonly overallFreshness: MarketDataFreshness;
  readonly valuationPartial: boolean;
}

export interface DashboardHoldingItem {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly displayName: string;
  readonly quantity: string;
  readonly averageCost: string;
  readonly currentPrice: string;
  readonly marketValue: string;
  readonly unrealizedPnL: string;
  readonly unrealizedPnLPercent: string;
  readonly dailyMarketChangePercent: string | null;
  readonly dataFreshness: MarketDataFreshness;
}

export interface DashboardWatchlistItem {
  readonly id: string;
  readonly watchlistId: string;
  readonly watchlistName: string;
  readonly instrumentId: string;
  readonly symbol: string;
  readonly displayName: string;
  readonly currentPrice: string | null;
  readonly dailyMarketChangePercent: string | null;
  readonly dataFreshness: MarketDataFreshness;
}

export interface DashboardIPOItem {
  readonly id: string;
  readonly ipoName: string;
  readonly issuerName: string;
  readonly symbol?: string | null;
  readonly status: IPOStatus;
  readonly openDate?: string | null;
  readonly closeDate?: string | null;
  readonly closingSoon: boolean;
  readonly priceBandLow?: string | null;
  readonly priceBandHigh?: string | null;
}

export interface DashboardKhataOverview {
  readonly totalNetBalance: string;
  readonly totalReceivable: string;
  readonly totalPayable: string;
  readonly activeAccountsCount: number;
  readonly recentTransactions: Array<{
    readonly id: string;
    readonly accountId: string;
    readonly accountName: string;
    readonly type: 'MONEY_IN' | 'MONEY_OUT';
    readonly amount: string;
    readonly runningBalance: string;
    readonly transactionDate: string;
    readonly description: string;
  }>;
}

export interface UnifiedActivityItem {
  readonly id: string;
  readonly category: 'KHATA' | 'PORTFOLIO' | 'IPO' | 'NOTIFICATION';
  readonly title: string;
  readonly description: string;
  readonly timestamp: string;
  readonly referenceId?: string;
}

export interface DashboardSummaryDTO {
  readonly headerTelemetry: DashboardSection<DashboardHeaderTelemetry>;
  readonly portfolioOverview: DashboardSection<DashboardPortfolioOverview>;
  readonly topHoldings: DashboardSection<DashboardHoldingItem[]>;
  readonly watchlistSummary: DashboardSection<DashboardWatchlistItem[]>;
  readonly ipoSummary: DashboardSection<{
    readonly activeIpos: DashboardIPOItem[];
    readonly userApplications: IPOApplicationRecord[];
  }>;
  readonly khataSummary: DashboardSection<DashboardKhataOverview>;
  readonly alertsSummary: DashboardSection<{
    readonly activeRulesCount: number;
    readonly unreadCount: number;
    readonly recentNotifications: NotificationRecord[];
  }>;
  readonly activityStream: DashboardSection<UnifiedActivityItem[]>;
  readonly generatedAt: string;
}

// ==========================================
// 3.9 REPORTS & ANALYTICS TYPES (PHASE 16)
// ==========================================

export type DateRangePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'CURRENT_WEEK'
  | 'PREVIOUS_WEEK'
  | 'CURRENT_MONTH'
  | 'PREVIOUS_MONTH'
  | 'CURRENT_QUARTER'
  | 'PREVIOUS_QUARTER'
  | 'CURRENT_YEAR'
  | 'PREVIOUS_YEAR'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface DateRangeFilter {
  readonly preset?: DateRangePreset;
  readonly fromDate?: string; // YYYY-MM-DD or ISO string
  readonly toDate?: string;   // YYYY-MM-DD or ISO string
  readonly timezone?: string; // Default: 'Asia/Kolkata'
}

export interface ResolvedUtcDateRange {
  readonly fromUtc: string; // ISO 8601 UTC string (e.g. 2026-09-21T18:30:00.000Z)
  readonly toUtc: string;   // ISO 8601 UTC string (e.g. 2026-09-22T18:29:59.999Z)
  readonly preset: DateRangePreset;
  readonly timezone: string;
}

export interface ReportSummaryDTO {
  readonly portfolioCount: number;
  readonly totalMarketValue: string;
  readonly totalAcquisitionCost: string;
  readonly unrealizedPnL: string;
  readonly unrealizedPnLPercent: string;
  readonly realizedPnL: string;
  readonly totalPnL: string;
  readonly valuationCoverage: ValuationCoverageRecord;
  readonly khataNetBalance: string;
  readonly khataReceivable: string;
  readonly khataPayable: string;
  readonly activeIpoApplicationsCount: number;
  readonly allotmentSuccessRatePercent: string | null;
  readonly activeAlertRulesCount: number;
  readonly unreadNotificationsCount: number;
  readonly generatedAt: string;
  readonly filter: DateRangeFilter;
}

export interface PortfolioPerformanceReportDTO {
  readonly portfolioId?: string;
  readonly portfolioName?: string;
  readonly isMultiPortfolio: boolean;
  readonly currentSnapshot: {
    readonly totalMarketValue: string;
    readonly activeAcquisitionCost: string;
    readonly unrealizedPnL: string;
    readonly unrealizedPnLPercent: string;
    readonly holdingCount: number;
    readonly valuationCoverage: ValuationCoverageRecord;
    readonly overallFreshness: MarketDataFreshness;
    readonly valuationAsOf: string | null;
  };
  readonly periodPerformance: {
    readonly dateRange: ResolvedUtcDateRange;
    readonly realizedPnL: string;
    readonly netCapitalInvested: string;
    readonly totalProceedsFromSales: string;
    readonly totalCapitalDeployed: string;
    readonly simpleReturnPercent: string | null;
    readonly xirrPercent: string | null;
    readonly xirrStatus: 'CALCULATED' | 'UNAVAILABLE';
    readonly cagrPercent: string | null;
    readonly cagrStatus: 'CALCULATED' | 'UNAVAILABLE';
    readonly cagrEligibilityReason?: string | null;
  };
  readonly generatedAt: string;
}

export interface AssetAllocationItem {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly displayName: string;
  readonly securityType: MarketSecurityType;
  readonly exchange: MarketExchange;
  readonly quantity: string;
  readonly currentPrice: string | null;
  readonly marketValue: string | null;
  readonly acquisitionCost: string;
  readonly allocationPercent: string | null;
  readonly dataFreshness: MarketDataFreshness;
}

export interface AssetAllocationBySecurityType {
  readonly securityType: MarketSecurityType;
  readonly marketValue: string;
  readonly allocationPercent: string;
  readonly holdingCount: number;
}

export interface AssetAllocationReportDTO {
  readonly portfolioId?: string;
  readonly totalMarketValue: string;
  readonly totalAcquisitionCost: string;
  readonly valuedHoldingsCount: number;
  readonly unvaluedHoldingsCount: number;
  readonly holdings: AssetAllocationItem[];
  readonly breakdownBySecurityType: AssetAllocationBySecurityType[];
  readonly overallFreshness: MarketDataFreshness;
  readonly generatedAt: string;
}

export interface KhataCashFlowTransactionItem {
  readonly id: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly type: 'MONEY_IN' | 'MONEY_OUT';
  readonly amount: string;
  readonly runningBalance: string;
  readonly transactionDate: string;
  readonly description: string;
}

export interface KhataAccountCashFlowSummary {
  readonly accountId: string;
  readonly accountName: string;
  readonly partyName: string;
  readonly totalInflow: string;
  readonly totalOutflow: string;
  readonly netMovement: string;
  readonly currentBalance: string;
}

export interface KhataCashFlowReportDTO {
  readonly accountId?: string;
  readonly dateRange: ResolvedUtcDateRange;
  readonly totalInflow: string;
  readonly totalOutflow: string;
  readonly netCashMovement: string;
  readonly totalReceivable: string;
  readonly totalPayable: string;
  readonly netBalance: string;
  readonly accountSummaries: KhataAccountCashFlowSummary[];
  readonly transactions: PaginatedResponse<KhataCashFlowTransactionItem>;
  readonly generatedAt: string;
}

export interface IPOParticipationReportDTO {
  readonly dateRange: ResolvedUtcDateRange;
  readonly totalApplicationsCount: number;
  readonly totalCapitalCommitted: string;
  readonly statusBreakdown: IPOApplicationSummary;
  readonly allotmentStats: {
    readonly verifiedAllotmentCount: number;
    readonly totalVerifiedOutcomeCount: number;
    readonly allottedCount: number;
    readonly partiallyAllottedCount: number;
    readonly notAllottedCount: number;
    readonly rejectedCount: number;
    readonly allotmentSuccessRatePercent: string | null;
    readonly unverifiedCount: number;
  };
  readonly activeIssuesCount: number;
  readonly applications: IPOApplicationRecord[];
  readonly generatedAt: string;
}

export interface AlertsAnalyticsReportDTO {
  readonly activeRulesCount: number;
  readonly pausedRulesCount: number;
  readonly totalRulesCount: number;
  readonly rulesByType: Array<{
    readonly alertType: AlertType;
    readonly count: number;
  }>;
  readonly totalTriggersInPeriod: number;
  readonly unreadNotificationsCount: number;
  readonly readNotificationsCount: number;
  readonly totalNotificationsCount: number;
  readonly recentTriggerEvents: AlertEventRecord[];
  readonly recentNotifications: NotificationRecord[];
  readonly generatedAt: string;
}




