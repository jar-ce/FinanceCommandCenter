import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { CommandCenterPage } from './pages/CommandCenterPage';
import { KhataPage } from './pages/KhataPage';
import { IpoPage, IpoApplicationsPage, IpoAllotmentPage } from './pages/IpoPages';
import { MarketsPage, StockSearchPage, StockDetailsPage, WatchlistPage } from './pages/MarketPages';
import { PortfolioPage, TransactionsPage, PnlPage } from './pages/PortfolioPages';
import { AlertsPage, ReportsPage, AnalyticsPage } from './pages/IntelligencePages';
import { NotificationsPage, SettingsPage, NotFoundPage } from './pages/SystemPages';

const routeTitleMap: Record<string, string> = {
  '/': 'Command Center',
  '/khata': 'Digital Khata',
  '/ipo': 'IPO Dashboard',
  '/ipo/applications': 'IPO Applications',
  '/ipo/allotment': 'IPO Allotment Checker',
  '/markets': 'Market Overview',
  '/markets/stocks': 'Stock Search & Securities Master',
  '/stocks': 'Stock Search & Securities Master',
  '/watchlist': 'Stock Watchlist Workspace',
  '/markets/watchlist': 'Stock Watchlist Workspace',
  '/portfolio': 'Portfolio Holdings',
  '/portfolio/transactions': 'Transactions Log',
  '/portfolio/pnl': 'P&L Statement',
  '/alerts': 'Alerts Intelligence',
  '/reports': 'Financial Reports',
  '/analytics': 'Portfolio Analytics',
  '/notifications': 'System Notifications',
  '/settings': 'System Settings'
};

const ShellWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const titleKey = location.pathname.startsWith('/stocks/') ? '/stocks' : location.pathname;
  const currentTitle = routeTitleMap[titleKey] || 'APEX OS';

  return <AppShell activeSectionTitle={currentTitle}>{children}</AppShell>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ShellWrapper>
        <Routes>
          <Route path="/" element={<CommandCenterPage />} />
          <Route path="/khata" element={<KhataPage />} />
          <Route path="/ipo" element={<IpoPage />} />
          <Route path="/ipo/applications" element={<IpoApplicationsPage />} />
          <Route path="/ipo/allotment" element={<IpoAllotmentPage />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/markets/stocks" element={<StockSearchPage />} />
          <Route path="/stocks" element={<StockSearchPage />} />
          <Route path="/stocks/:id" element={<StockDetailsPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/markets/watchlist" element={<WatchlistPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/portfolio/transactions" element={<TransactionsPage />} />
          <Route path="/portfolio/pnl" element={<PnlPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ShellWrapper>
    </BrowserRouter>
  );
};

export default App;
