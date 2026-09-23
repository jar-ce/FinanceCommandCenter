/**
 * FINANCE COMMAND CENTER (APEX OS)
 * Reports & Analytics API Routes (Phase 16)
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DrizzleAlertRepository } from '../infrastructure/repositories/DrizzleAlertRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DrizzlePortfolioRepository } from '../infrastructure/repositories/DrizzlePortfolioRepository.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DrizzleIPOApplicationRepository } from '../infrastructure/repositories/DrizzleIPOApplicationRepository.js';
import { DrizzleIPOAllotmentRepository } from '../infrastructure/repositories/DrizzleIPOAllotmentRepository.js';
import { DrizzleKhataAccountRepository } from '../infrastructure/repositories/DrizzleKhataAccountRepository.js';
import { DrizzleKhataTransactionRepository } from '../infrastructure/repositories/DrizzleKhataTransactionRepository.js';
import { DrizzleWatchlistRepository } from '../infrastructure/repositories/DrizzleWatchlistRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { DevelopmentIPOProvider } from '../infrastructure/providers/DevelopmentIPOProvider.js';
import { DevelopmentMarketDataProvider } from '../infrastructure/providers/DevelopmentMarketDataProvider.js';

import { PnlService } from '../domain/services/PnlService.js';
import { PortfolioService } from '../domain/services/PortfolioService.js';
import { WatchlistService } from '../domain/services/WatchlistService.js';
import { IPOService } from '../domain/services/IPOService.js';
import { IPOApplicationService } from '../domain/services/IPOApplicationService.js';
import { KhataService } from '../domain/services/KhataService.js';
import { AlertService } from '../domain/services/AlertService.js';
import { NotificationService } from '../domain/services/NotificationService.js';
import { MarketDataService } from '../domain/services/MarketDataService.js';
import { ReportService } from '../domain/services/ReportService.js';

import { requireAuthentication, resolveDevelopmentIdentity } from '../infrastructure/auth/authMiddleware.js';

function resolveIdentity(request: any): string {
  return resolveDevelopmentIdentity(request);
}

const dateRangeQuerySchema = z.object({
  preset: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional()
});

const portfolioReportQuerySchema = dateRangeQuerySchema.extend({
  portfolioId: z.string().uuid().optional()
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

const khataReportQuerySchema = dateRangeQuerySchema.merge(paginationQuerySchema).extend({
  accountId: z.string().uuid().optional()
});

const alertRepo = new DrizzleAlertRepository();
const marketRepo = new DrizzleMarketRepository();
const portfolioRepo = new DrizzlePortfolioRepository();
const ipoRepo = new DrizzleIPORepository();
const ipoAppRepo = new DrizzleIPOApplicationRepository();
const ipoAllotmentRepo = new DrizzleIPOAllotmentRepository();
const khataAccountRepo = new DrizzleKhataAccountRepository();
const khataTxRepo = new DrizzleKhataTransactionRepository();
const watchlistRepo = new DrizzleWatchlistRepository();
const auditLogRepo = new DrizzleAuditLogRepository();
const ipoDataProvider = new DevelopmentIPOProvider();
const marketProvider = new DevelopmentMarketDataProvider();

const pnlService = new PnlService(portfolioRepo, marketRepo);
const portfolioService = new PortfolioService(portfolioRepo, marketRepo, auditLogRepo);
const watchlistService = new WatchlistService(watchlistRepo, marketRepo, auditLogRepo);
const ipoService = new IPOService(ipoRepo, ipoDataProvider, auditLogRepo);
const ipoAppService = new IPOApplicationService(ipoAppRepo, ipoRepo, khataAccountRepo, auditLogRepo);
const khataService = new KhataService(khataAccountRepo, khataTxRepo, auditLogRepo);
const alertService = new AlertService(alertRepo, marketRepo, portfolioRepo, ipoRepo, auditLogRepo);
const notificationService = new NotificationService(alertRepo, auditLogRepo);
const marketDataService = new MarketDataService(marketRepo, marketProvider);

const reportService = new ReportService(
  pnlService,
  portfolioService,
  watchlistService,
  ipoService,
  ipoAppService,
  ipoAllotmentRepo,
  khataService,
  alertService,
  notificationService,
  marketDataService
);

export const reportRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.addHook('preHandler', requireAuthentication);
  // Error handling hook for authentication
  fastify.setErrorHandler((error, _request, reply) => {

    if (error.message === 'MISSING_IDENTITY' || error.message === 'INVALID_IDENTITY') {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid x-user-id header is required.'
        },
        timestamp: new Date().toISOString()
      });
    }
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred.'
      },
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/reports/summary
  fastify.get('/summary', async (request, reply) => {
    const userId = resolveIdentity(request);
    const query = dateRangeQuerySchema.parse(request.query || {});
    const summary = await reportService.getReportSummary(userId, query as any);

    return reply.send({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/reports/portfolio-performance
  fastify.get('/portfolio-performance', async (request, reply) => {
    const userId = resolveIdentity(request);
    const query = portfolioReportQuerySchema.parse(request.query || {});
    const report = await reportService.getPortfolioPerformanceReport(userId, query.portfolioId, query as any);

    return reply.send({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/reports/asset-allocation
  fastify.get('/asset-allocation', async (request, reply) => {
    const userId = resolveIdentity(request);
    const query = portfolioReportQuerySchema.parse(request.query || {});
    const report = await reportService.getAssetAllocationReport(userId, query.portfolioId);

    return reply.send({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/reports/realized-pnl
  fastify.get('/realized-pnl', async (request, reply) => {
    const userId = resolveIdentity(request);
    const query = paginationQuerySchema.extend({
      portfolioId: z.string().uuid().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional()
    }).parse(request.query || {});

    const filter = (query.fromDate || query.toDate) ? { fromDate: query.fromDate, toDate: query.toDate } : undefined;
    const report = await reportService.getRealizedPnLReport(userId, query.portfolioId, filter, query.page, query.limit);

    return reply.send({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/reports/khata-cashflow
  fastify.get('/khata-cashflow', async (request, reply) => {
    const userId = resolveIdentity(request);
    const query = khataReportQuerySchema.parse(request.query || {});
    const report = await reportService.getKhataCashFlowReport(userId, query.accountId, query as any, query.page, query.limit);

    return reply.send({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/reports/ipo-participation
  fastify.get('/ipo-participation', async (request, reply) => {
    const userId = resolveIdentity(request);
    const query = dateRangeQuerySchema.parse(request.query || {});
    const report = await reportService.getIPOParticipationReport(userId, query as any);

    return reply.send({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/reports/alerts-analytics
  fastify.get('/alerts-analytics', async (request, reply) => {
    const userId = resolveIdentity(request);
    const query = dateRangeQuerySchema.parse(request.query || {});
    const report = await reportService.getAlertsAnalyticsReport(userId, query as any);

    return reply.send({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  });
};
