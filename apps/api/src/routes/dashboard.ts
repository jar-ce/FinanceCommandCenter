import { FastifyPluginAsync } from 'fastify';
import { DrizzleAlertRepository } from '../infrastructure/repositories/DrizzleAlertRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DrizzlePortfolioRepository } from '../infrastructure/repositories/DrizzlePortfolioRepository.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DrizzleIPOApplicationRepository } from '../infrastructure/repositories/DrizzleIPOApplicationRepository.js';
import { DrizzleKhataAccountRepository } from '../infrastructure/repositories/DrizzleKhataAccountRepository.js';
import { DrizzleKhataTransactionRepository } from '../infrastructure/repositories/DrizzleKhataTransactionRepository.js';
import { DrizzleWatchlistRepository } from '../infrastructure/repositories/DrizzleWatchlistRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { DevelopmentIPOProvider } from '../infrastructure/providers/DevelopmentIPOProvider.js';
import { PnlService } from '../domain/services/PnlService.js';
import { PortfolioService } from '../domain/services/PortfolioService.js';
import { WatchlistService } from '../domain/services/WatchlistService.js';
import { IPOService } from '../domain/services/IPOService.js';
import { IPOApplicationService } from '../domain/services/IPOApplicationService.js';
import { KhataService } from '../domain/services/KhataService.js';
import { AlertService } from '../domain/services/AlertService.js';
import { NotificationService } from '../domain/services/NotificationService.js';
import { DashboardService } from '../domain/services/DashboardService.js';

import { resolveAuthenticatedPrincipal } from '../infrastructure/auth/authMiddleware.js';

const alertRepo = new DrizzleAlertRepository();
const marketRepo = new DrizzleMarketRepository();
const portfolioRepo = new DrizzlePortfolioRepository();
const ipoRepo = new DrizzleIPORepository();
const ipoAppRepo = new DrizzleIPOApplicationRepository();
const khataAccountRepo = new DrizzleKhataAccountRepository();
const khataTxRepo = new DrizzleKhataTransactionRepository();
const watchlistRepo = new DrizzleWatchlistRepository();
const auditLogRepo = new DrizzleAuditLogRepository();
const ipoDataProvider = new DevelopmentIPOProvider();

const pnlService = new PnlService(portfolioRepo, marketRepo);
const portfolioService = new PortfolioService(portfolioRepo, marketRepo, auditLogRepo);
const watchlistService = new WatchlistService(watchlistRepo, marketRepo, auditLogRepo);
const ipoService = new IPOService(ipoRepo, ipoDataProvider, auditLogRepo);
const ipoAppService = new IPOApplicationService(ipoAppRepo, ipoRepo, khataAccountRepo, auditLogRepo);
const khataService = new KhataService(khataAccountRepo, khataTxRepo, auditLogRepo);
const alertService = new AlertService(alertRepo, marketRepo, portfolioRepo, ipoRepo, auditLogRepo);
const notificationService = new NotificationService(alertRepo, auditLogRepo);

const dashboardService = new DashboardService(
  pnlService,
  portfolioService,
  watchlistService,
  ipoService,
  ipoAppService,
  khataService,
  alertService,
  notificationService
);

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/summary', async (request, reply) => {
    let userId: string;
    try {
      const principal = resolveAuthenticatedPrincipal(request);
      userId = principal.userId;
    } catch {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token missing, invalid, or forged. Provide valid Bearer token or signed credentials.'
        },
        timestamp: new Date().toISOString()
      });
    }

    try {
      const summary = await dashboardService.getDashboardSummary(userId);
      return reply.send({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DASHBOARD_ERROR',
          message: err.message || 'An unexpected error occurred building the dashboard summary.'
        },
        timestamp: new Date().toISOString()
      });
    }
  });
};
