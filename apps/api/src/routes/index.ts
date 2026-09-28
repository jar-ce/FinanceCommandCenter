import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { authRoutes } from './auth.js';
import { khataRoutes } from './khata.js';
import { ipoRoutes } from './ipo.js';
import { ipoApplicationsRoutes } from './ipo-applications.js';
import { ipoAllotmentRoutes } from './ipo-allotments.js';
import { marketRoutes } from './market.js';
import { watchlistRoutes } from './watchlists.js';
import { portfolioRoutes } from './portfolios.js';
import { pnlRoutes } from './pnl.js';
import { alertRoutes } from './alerts.js';
import { notificationRoutes } from './notifications.js';
import { dashboardRoutes } from './dashboard.js';
import { reportRoutes } from './reports.js';

export const apiRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(khataRoutes, { prefix: '/khata' });
  await fastify.register(ipoRoutes, { prefix: '/ipo' });
  await fastify.register(ipoApplicationsRoutes, { prefix: '/ipo/applications' });
  await fastify.register(ipoAllotmentRoutes, { prefix: '/ipo/allotments' });
  await fastify.register(marketRoutes, { prefix: '/market' });
  await fastify.register(watchlistRoutes, { prefix: '/watchlists' });
  await fastify.register(portfolioRoutes, { prefix: '/portfolios' });
  await fastify.register(pnlRoutes, { prefix: '/portfolios' });
  await fastify.register(alertRoutes, { prefix: '/alerts' });
  await fastify.register(notificationRoutes, { prefix: '/notifications' });
  await fastify.register(dashboardRoutes, { prefix: '/dashboard' });
  await fastify.register(reportRoutes, { prefix: '/reports' });
};





