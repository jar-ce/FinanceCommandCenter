import React from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { PieChart } from 'lucide-react';

export { AlertsPage } from './AlertsPage';
export { ReportsPage } from './ReportsPage';


export const AnalyticsPage: React.FC = () => (
  <PageContainer>
    <PageHeader title="Analytics" description="Portfolio Concentration & Risk Metrics" phaseBadge="TARGET: PHASE 9" />
    <EmptyState
      title="Analytics Intelligence Module Pending"
      description="The frontend shell navigation is verified. Risk metrics and portfolio analytics will be integrated in Phase 9."
      icon={<PieChart size={36} color="var(--color-brand-accent)" />}
    />
  </PageContainer>
);
