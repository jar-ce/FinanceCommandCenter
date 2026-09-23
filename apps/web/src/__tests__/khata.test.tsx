import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KhataPage } from '../pages/KhataPage';

describe('Frontend Digital Khata Module Workspace', () => {
  beforeEach(() => {
    // Reset fetch mocks
    vi.restoreAllMocks();
  });

  it('renders Digital Khata header, summary strip, and empty account state', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/khata/accounts') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [], meta: { summary: { totalReceivable: '0.0000', totalPayable: '0.0000', netBalance: '0.0000' } } })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    });

    render(
      <MemoryRouter>
        <KhataPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Digital Khata')).toBeDefined();
    expect(screen.getByText('TOTAL NET BALANCE')).toBeDefined();
    expect(screen.getByText('YOU WILL GET (RECEIVABLE)')).toBeDefined();
    expect(screen.getByText('YOU WILL GIVE (PAYABLE)')).toBeDefined();
    expect(screen.getByText('No Account Selected')).toBeDefined();
  });

  it('opens Create Account modal when Add Account button is clicked', async () => {
    render(
      <MemoryRouter>
        <KhataPage />
      </MemoryRouter>
    );

    const addAccBtn = screen.getByText('Add Account');
    fireEvent.click(addAccBtn);

    expect(screen.getByText('Create New Khata Account')).toBeDefined();
    expect(screen.getByText('Display Name *')).toBeDefined();
  });

  it('renders accounts list and selected account ledger when accounts exist', async () => {
    const mockAccounts = [
      {
        id: 'acc-1',
        displayName: 'Acme Traders',
        phone: '9876543210',
        accountType: 'CUSTOMER',
        status: 'ACTIVE',
        netBalance: '500.0000',
        totalMoneyIn: '1000.0000',
        totalMoneyOut: '500.0000',
        statusText: 'RECEIVABLE'
      }
    ];

    const mockTransactions = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'MONEY_IN',
        amount: '1000.0000',
        runningBalance: '1000.0000',
        transactionDate: '2026-09-15T00:00:00.000Z',
        description: 'Goods Sold',
        reference: 'INV-101'
      }
    ];

    global.fetch = vi.fn().mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      if (url.includes('/api/v1/khata/accounts')) {
        if (url.includes('/transactions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockTransactions })
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: mockAccounts,
            meta: { summary: { totalReceivable: '500.0000', totalPayable: '0.0000', netBalance: '500.0000' } }
          })
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) } as Response);
    });

    render(
      <MemoryRouter>
        <KhataPage />
      </MemoryRouter>
    );

    // Wait for account rendering (appears in list and header)
    await waitFor(() => {
      expect(screen.getAllByText('Acme Traders').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Give Money (+)')).toBeDefined();
    expect(screen.getByText('Got Money (-)')).toBeDefined();
  });
});
