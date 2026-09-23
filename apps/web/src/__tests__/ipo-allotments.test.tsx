import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IpoAllotmentPage } from '../pages/IpoAllotmentPage';

describe('Frontend Phase 8 IPO Allotment Workspace Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders IPO Allotment Checker header, summary cards, and empty state when dataset is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/ipo/allotments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [],
            summary: {
              total: 0,
              verified: 0,
              unverified: 0,
              stale: 0,
              manualRequired: 0,
              unavailable: 0,
              allottedCount: 0,
              partiallyAllottedCount: 0,
              notAllottedCount: 0
            }
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
        <IpoAllotmentPage />
      </MemoryRouter>
    );

    expect(screen.getByText('IPO ALLOTMENT CHECKER')).toBeDefined();
    expect(screen.getByText('Awaiting Verification')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('No Allotment Records Found')).toBeDefined();
    });
  });

  it('renders allotments table with ResizableTable columns when data exists', async () => {
    const mockAllotments = [
      {
        id: '00000000-0000-4000-a000-000000000088',
        userId: '00000000-0000-4000-a000-000000000001',
        applicationId: '00000000-0000-4000-a000-000000000099',
        allotmentStatus: 'ALLOTTED',
        verificationStatus: 'VERIFIED',
        verificationMethod: 'MANUAL',
        appliedQuantity: 65,
        allottedQuantity: 65,
        allotmentRatio: '1.0000',
        provider: 'MANUAL_VERIFICATION',
        source: 'Link Intime Portal',
        maskedApplicationNumber: 'APP-***9911',
        ipoName: 'Stellar Tech IPO',
        issuerName: 'Stellar Tech Systems Ltd',
        symbol: 'STELLAR',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/ipo/allotments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: mockAllotments,
            summary: {
              total: 1,
              verified: 1,
              unverified: 0,
              stale: 0,
              manualRequired: 0,
              unavailable: 0,
              allottedCount: 1,
              partiallyAllottedCount: 0,
              notAllottedCount: 0
            }
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
        <IpoAllotmentPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Stellar Tech IPO')).toBeDefined();
      expect(screen.getByText('APP-***9911')).toBeDefined();
      expect(screen.getByText('ALLOTTED')).toBeDefined();
      expect(screen.getByText('VERIFIED (MANUAL)')).toBeDefined();
    });
  });

  it('opens Manual Verification modal when Verify button is clicked', async () => {
    const mockApplications = [
      {
        id: '00000000-0000-4000-a000-000000000099',
        ipoName: 'Alpha Tech IPO',
        quantityApplied: 100,
        status: 'COMPLETED'
      }
    ];

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/ipo/applications')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockApplications })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          summary: { total: 0, verified: 0, unverified: 0, stale: 0, manualRequired: 0, unavailable: 0, allottedCount: 0, partiallyAllottedCount: 0, notAllottedCount: 0 }
        })
      });
    }));

    render(
      <MemoryRouter>
        <IpoAllotmentPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Tech IPO')).toBeDefined();
    });

    const verifyBtns = screen.getAllByRole('button', { name: 'Verify' });
    fireEvent.click(verifyBtns[0]);

    expect(screen.getByText('Manual Allotment Verification')).toBeDefined();
    expect(screen.getByText('Confirm Manual Verification')).toBeDefined();
  });
});
