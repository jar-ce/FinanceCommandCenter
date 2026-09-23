import React from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { TrendingUp } from 'lucide-react';
export { StockSearchPage, StockSearchPage as StocksPage } from './StockSearchPage';
export { StockDetailsPage } from './StockDetailsPage';
export { WatchlistPage } from './WatchlistPage';
export { PortfolioPage } from './PortfolioPage';

export const MarketsPage: React.FC = () => (
  <PageContainer>
    <PageHeader title="Market Overview" description="Broad Market Indices & Sector Performance" phaseBadge="TARGET: PHASE 15" />
    <EmptyState
      title="Market Overview Module Pending"
      description="The frontend shell navigation is verified. Real-time market indices and ticker streams will be integrated in Phase 15."
      icon={<TrendingUp size={36} color="var(--color-brand-primary)" />}
    />
  </PageContainer>
);

