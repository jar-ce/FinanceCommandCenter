// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertsPage } from '../pages/AlertsPage';
import { NotificationCenter } from '../components/shell/NotificationCenter';

describe('Frontend Phase 14 Alerts & Notifications Workspace Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. renders Alerts workspace header, summary strip, and empty state when dataset is empty', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/v1/alerts')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] })
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(<AlertsPage />);

    expect(screen.getByText('Alerts & Notifications Center')).toBeDefined();
    expect(screen.getByText('TOTAL RULES')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('No alert rules configured')).toBeDefined();
    });
  });

  it('2. renders alert rules table with ResizableTable columns when rules exist', async () => {
    const mockRules = [
      {
        id: 'rule-1',
        userId: '00000000-0000-4000-a000-000000000001',
        name: 'RELIANCE Price Above ₹2600',
        description: null,
        alertType: 'PRICE_ABOVE',
        targetType: 'MARKET_INSTRUMENT',
        targetId: '00000000-0000-4000-a000-000000000010',
        conditionOperator: 'GTE',
        thresholdValue: '2600.0000',
        cooldownMinutes: 60,
        status: 'ACTIVE',
        lastTriggeredAt: null,
        lastEvaluatedAt: null,
        lastEvaluatedValue: null,
        lastEvaluatedState: 'UNKNOWN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/v1/alerts')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockRules })
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(<AlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE Price Above ₹2600')).toBeDefined();
      expect(screen.getByText('PRICE_ABOVE')).toBeDefined();
      expect(screen.getByText('₹2600.0000')).toBeDefined();
      expect(screen.getByText('ACTIVE')).toBeDefined();
    });
  });

  it('3. opens Create Alert modal when New Alert Rule button is clicked', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/v1/alerts')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] })
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(<AlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('New Alert Rule')).toBeDefined();
    });

    const newBtn = screen.getByText('New Alert Rule');
    fireEvent.click(newBtn);

    expect(screen.getByText('Configure New Alert Rule')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g. RELIANCE Price Above ₹2500')).toBeDefined();
  });

  it('4. renders NotificationCenter shell header component and displays unread badge', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/unread-count')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { unreadCount: 3 } })
        } as Response;
      }
      if (urlStr.includes('/api/v1/notifications')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              items: [
                {
                  id: 'notif-1',
                  userId: '00000000-0000-4000-a000-000000000001',
                  alertEventId: 'evt-1',
                  alertRuleId: 'rule-1',
                  notificationType: 'MARKET_ALERT',
                  title: 'Price Alert Triggered',
                  message: 'INFY crossed above ₹1550',
                  status: 'UNREAD',
                  createdAt: new Date().toISOString()
                }
              ],
              total: 1
            }
          })
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(<NotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeDefined();
    });

    const bellBtn = screen.getByLabelText(/Notifications/);
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('Price Alert Triggered')).toBeDefined();
      expect(screen.getByText('INFY crossed above ₹1550')).toBeDefined();
    });
  });
});
