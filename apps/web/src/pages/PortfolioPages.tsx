import React from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { Receipt, DollarSign } from 'lucide-react';

export { PortfolioPage } from './PortfolioPage';

export const TransactionsPage: React.FC = () => (
  <PageContainer>
    <PageHeader title="Transactions Log" description="Trade History & Execution Ledger" phaseBadge="TARGET: PHASE 8" />
    <EmptyState
      title="Transactions Log Module Pending"
      description="The frontend shell navigation is verified. Trade execution logs and transaction history will be integrated in Phase 8."
      icon={<Receipt size={36} color="var(--color-brand-accent)" />}
    />
  </PageContainer>
);

export const PnlPage: React.FC = () => (
  <PageContainer>
    <PageHeader title="P&L Statement" description="Realized & Unrealized Return Performance" phaseBadge="TARGET: PHASE 8" />
    <EmptyState
      title="P&L Statement Module Pending"
      description="The frontend shell navigation is verified. Realized/Unrealized P&L calculations powered by decimal.js will be integrated in Phase 8."
      icon={<DollarSign size={36} color="var(--color-positive)" />}
    />
  </PageContainer>
);
