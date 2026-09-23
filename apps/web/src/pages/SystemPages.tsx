import React from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { Inbox, Settings, AlertOctagon } from 'lucide-react';

export const NotificationsPage: React.FC = () => (
  <PageContainer>
    <PageHeader title="Notifications" description="System Logs & User Inbox" phaseBadge="SHELL PLACEHOLDER" />
    <EmptyState
      title="Notifications Center"
      description="System activity logs and automated notifications inbox."
      icon={<Inbox size={36} color="var(--color-brand-primary)" />}
    />
  </PageContainer>
);

export const SettingsPage: React.FC = () => (
  <PageContainer>
    <PageHeader title="Settings" description="APEX OS System & Interface Configuration" phaseBadge="SHELL PLACEHOLDER" />
    <EmptyState
      title="System Settings"
      description="Interface themes, database connection settings, and user preferences."
      icon={<Settings size={36} color="var(--color-text-secondary)" />}
    />
  </PageContainer>
);

export const NotFoundPage: React.FC = () => (
  <PageContainer>
    <PageHeader title="404 — Route Not Found" description="The requested view does not exist in APEX OS." phaseBadge="SYSTEM ERROR" />
    <EmptyState
      title="Invalid Navigation Target"
      description="The route you navigated to is not registered in the APEX OS Command Rail."
      icon={<AlertOctagon size={36} color="var(--color-negative)" />}
    />
  </PageContainer>
);
