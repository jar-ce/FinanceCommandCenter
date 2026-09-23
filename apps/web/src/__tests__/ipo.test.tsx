import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IpoPage, IpoApplicationsPage, IpoAllotmentPage } from '../pages/IpoPages';


describe('Frontend Phase 6 IPO Center Workspace Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders IPO Center header, pipeline cards, and empty state when dataset is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
        pipeline: { upcoming: 0, open: 0, closed: 0, listed: 0, total: 0 }
      })
    }));

    render(<IpoPage />);

    expect(screen.getByText('IPO Center')).toBeDefined();
    expect(screen.getByText('PHASE 6 ACTIVE')).toBeDefined();
    expect(screen.getByText('Source:')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('No IPO Data Currently Available')).toBeDefined();
    });
  });

  it('renders IPO Master records, pipeline counts, and ResizableTable when data exists', async () => {
    const mockData = [
      {
        id: '00000000-0000-4000-a000-000000000001',
        externalId: 'EXT_001',
        provider: 'DEVELOPMENT_STUB',
        source: 'Public Exchange Disclosure Feed',
        issuerName: 'Acme Semiconductor Ltd',
        ipoName: 'Acme Semi Mainboard IPO',
        symbol: 'ACMESEMI',
        exchange: 'NSE',
        securityType: 'EQUITY',
        issueType: 'MAINBOARD',
        status: 'OPEN',
        openDate: '2026-09-15T00:00:00.000Z',
        closeDate: '2026-09-18T00:00:00.000Z',
        priceBandLow: '100.0000',
        priceBandHigh: '108.0000',
        lotSize: 135,
        maxLotCost: '14580.0000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockData,
        pipeline: { upcoming: 0, open: 1, closed: 0, listed: 0, total: 1 }
      })
    }));

    render(<IpoPage />);

    await waitFor(() => {
      expect(screen.getByText('Acme Semiconductor Ltd')).toBeDefined();
      expect(screen.getByText('Acme Semi Mainboard IPO')).toBeDefined();
      expect(screen.getByText('ACMESEMI')).toBeDefined();
      expect(screen.getByText('₹100 – ₹108')).toBeDefined();
      expect(screen.getByText('135 Shares')).toBeDefined();
    });
  });

  it('verifies Phase 7 active page and Phase 8 active allotment page render headers', () => {
    render(
      <MemoryRouter>
        <IpoApplicationsPage />
      </MemoryRouter>
    );
    expect(screen.getByText('PHASE 7 ACTIVE')).toBeDefined();

    render(
      <MemoryRouter>
        <IpoAllotmentPage />
      </MemoryRouter>
    );
    expect(screen.getByText('IPO ALLOTMENT CHECKER')).toBeDefined();
  });
});
