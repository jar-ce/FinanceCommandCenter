import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IpoApplicationsPage } from '../pages/IpoApplicationsPage';

describe('Frontend Phase 7 IPO Applications Workspace Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders IPO Applications header, summary cards, and empty state when dataset is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/ipo/applications')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [],
            summary: { total: 0, draft: 0, submitted: 0, paymentPending: 0, paymentConfirmed: 0, completed: 0, cancelled: 0 }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    }));

    render(
      <MemoryRouter>
        <IpoApplicationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('IPO Application Tracker')).toBeDefined();
    expect(screen.getByText('PHASE 7 ACTIVE')).toBeDefined();
    expect(screen.getByText('My IPO Applications')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('No IPO Applications Recorded Yet')).toBeDefined();
    });
  });

  it('renders applications table with ResizableTable columns when data exists', async () => {
    const mockApp = {
      id: '00000000-0000-4000-a000-000000000010',
      userId: '00000000-0000-4000-a000-000000000001',
      ipoId: '00000000-0000-4000-a000-000000000002',
      applicationAccountId: '00000000-0000-4000-a000-000000000003',
      applicationDate: '2026-09-20T10:00:00.000Z',
      lotsApplied: 2,
      quantityApplied: 130,
      applicationAmount: '27950.0000',
      status: 'SUBMITTED',
      paymentReference: 'UPI-MANDATE-771122',
      notes: 'Applied via HDFC Internet Banking',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      issuerName: 'Solaris Energy Ltd',
      ipoName: 'Solaris Energy IPO',
      symbol: 'SOLARIS',
      accountDisplayName: 'Primary Zerodha Account'
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/ipo/applications')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [mockApp],
            summary: { total: 1, draft: 0, submitted: 1, paymentPending: 0, paymentConfirmed: 0, completed: 0, cancelled: 0 }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    }));

    render(
      <MemoryRouter>
        <IpoApplicationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Solaris Energy Ltd')).toBeDefined();
      expect(screen.getByText('Primary Zerodha Account')).toBeDefined();
      expect(screen.getByText('SUBMITTED')).toBeDefined();
    });
  });

  it('opens Create Application modal when Track New Application button is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          summary: { total: 0, draft: 0, submitted: 0, paymentPending: 0, paymentConfirmed: 0, completed: 0, cancelled: 0 }
        })
      });
    }));

    render(
      <MemoryRouter>
        <IpoApplicationsPage />
      </MemoryRouter>
    );

    const trackBtn = screen.getByText('Track New Application');
    fireEvent.click(trackBtn);

    await waitFor(() => {
      expect(screen.getByText('Track IPO Application')).toBeDefined();
      expect(screen.getByText('Select Canonical IPO *')).toBeDefined();
      expect(screen.getByText('Application Account / Broker *')).toBeDefined();
    });
  });
});
