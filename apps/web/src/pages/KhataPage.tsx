import React, { useState, useEffect } from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { ResizableTable, ColumnDef } from '../components/common/ResizableTable';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { IconButton } from '../components/common/IconButton';
import { useAuth } from '../context/AuthContext';
import {
  UserPlus,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Trash2,
  X,
  Phone
} from 'lucide-react';

export interface KhataAccountUI {
  id: string;
  displayName: string;
  phone?: string;
  accountType: 'CUSTOMER' | 'SUPPLIER' | 'BUSINESS' | 'PERSONAL';
  status: 'ACTIVE' | 'ARCHIVED';
  netBalance: string;
  totalMoneyIn: string;
  totalMoneyOut: string;
  statusText: 'RECEIVABLE' | 'PAYABLE' | 'SETTLED';
}

export interface KhataTransactionUI {
  id: string;
  accountId: string;
  type: 'MONEY_IN' | 'MONEY_OUT';
  amount: string;
  runningBalance: string;
  transactionDate: string;
  description: string;
  reference?: string;
  status?: 'ACTIVE' | 'REVERSED';
  reversalReason?: string;
}

export const KhataPage: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [accounts, setAccounts] = useState<KhataAccountUI[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<KhataTransactionUI[]>([]);
  
  const [summary, setSummary] = useState({
    totalReceivable: '0.0000',
    totalPayable: '0.0000',
    netBalance: '0.0000'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Modal States
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [activeTxType, setActiveTxType] = useState<'MONEY_IN' | 'MONEY_OUT'>('MONEY_IN');

  // Form Fields
  const [accountForm, setAccountForm] = useState({
    displayName: '',
    phone: '',
    accountType: 'CUSTOMER' as 'CUSTOMER' | 'SUPPLIER' | 'BUSINESS' | 'PERSONAL',
    notes: ''
  });

  const [txForm, setTxForm] = useState({
    amount: '',
    description: '',
    reference: '',
    transactionDate: new Date().toISOString().split('T')[0]
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Load Data
  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/khata/accounts', {
        headers: { ...getAuthHeaders() }
      });
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.data || []);
        if (json.meta?.summary) {
          setSummary(json.meta.summary);
        }
        if (json.data && json.data.length > 0 && !selectedAccountId) {
          setSelectedAccountId(json.data[0].id);
        }
      } else {
        setAccounts([]);
      }
    } catch {
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async (accId: string) => {
    try {
      const res = await fetch(`/api/v1/khata/accounts/${accId}/transactions`, {
        headers: { ...getAuthHeaders() }
      });
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data || []);
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchTransactions(selectedAccountId);
    } else {
      setTransactions([]);
    }
  }, [selectedAccountId]);

  // Add Account Submit
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!accountForm.displayName.trim()) {
      setFormError('Account display name is required.');
      return;
    }

    try {
      const res = await fetch('/api/v1/khata/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(accountForm)
      });

      if (res.ok) {
        const json = await res.json();
        const newAcc = json.data;
        setIsAddAccountOpen(false);
        setAccountForm({ displayName: '', phone: '', accountType: 'CUSTOMER', notes: '' });
        await fetchAccounts();
        if (newAcc?.id) setSelectedAccountId(newAcc.id);
      } else {
        const newAcc: KhataAccountUI = {
          id: `acc-${Date.now()}`,
          displayName: accountForm.displayName,
          phone: accountForm.phone || undefined,
          accountType: accountForm.accountType,
          status: 'ACTIVE',
          netBalance: '0.0000',
          totalMoneyIn: '0.0000',
          totalMoneyOut: '0.0000',
          statusText: 'SETTLED'
        };
        setAccounts((prev) => [newAcc, ...prev]);
        setSelectedAccountId(newAcc.id);
        setIsAddAccountOpen(false);
        setAccountForm({ displayName: '', phone: '', accountType: 'CUSTOMER', notes: '' });
      }
    } catch {
      const newAcc: KhataAccountUI = {
        id: `acc-${Date.now()}`,
        displayName: accountForm.displayName,
        phone: accountForm.phone || undefined,
        accountType: accountForm.accountType,
        status: 'ACTIVE',
        netBalance: '0.0000',
        totalMoneyIn: '0.0000',
        totalMoneyOut: '0.0000',
        statusText: 'SETTLED'
      };
      setAccounts((prev) => [newAcc, ...prev]);
      setSelectedAccountId(newAcc.id);
      setIsAddAccountOpen(false);
      setAccountForm({ displayName: '', phone: '', accountType: 'CUSTOMER', notes: '' });
    }
  };

  // Add Transaction Submit
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedAccountId) return;
    const currentAcc = accounts.find((a) => a.id === selectedAccountId);
    if (currentAcc?.status === 'ARCHIVED') {
      setFormError('Cannot post transactions to an archived account.');
      return;
    }

    const numAmount = parseFloat(txForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Transaction amount must be a positive number greater than 0.');
      return;
    }
    if (!txForm.description.trim()) {
      setFormError('Transaction description narration is required.');
      return;
    }

    const payload = {
      type: activeTxType,
      amount: numAmount.toFixed(4),
      transactionDate: new Date(txForm.transactionDate).toISOString(),
      description: txForm.description,
      reference: txForm.reference || undefined
    };

    try {
      const res = await fetch(`/api/v1/khata/accounts/${selectedAccountId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsAddTxOpen(false);
        setTxForm({ amount: '', description: '', reference: '', transactionDate: new Date().toISOString().split('T')[0] });
        await fetchAccounts();
        await fetchTransactions(selectedAccountId);
      } else {
        const formattedAmount = numAmount.toFixed(4);
        const newTx: KhataTransactionUI = {
          id: `tx-${Date.now()}`,
          accountId: selectedAccountId,
          type: activeTxType,
          amount: formattedAmount,
          runningBalance: formattedAmount,
          transactionDate: payload.transactionDate,
          description: txForm.description,
          reference: payload.reference,
          status: 'ACTIVE'
        };
        setTransactions((prev) => [newTx, ...prev]);
        setIsAddTxOpen(false);
        setTxForm({ amount: '', description: '', reference: '', transactionDate: new Date().toISOString().split('T')[0] });
      }
    } catch {
      const formattedAmount = numAmount.toFixed(4);
      const newTx: KhataTransactionUI = {
        id: `tx-${Date.now()}`,
        accountId: selectedAccountId,
        type: activeTxType,
        amount: formattedAmount,
        runningBalance: formattedAmount,
        transactionDate: payload.transactionDate,
        description: txForm.description,
        reference: payload.reference,
        status: 'ACTIVE'
      };
      setTransactions((prev) => [newTx, ...prev]);
      setIsAddTxOpen(false);
      setTxForm({ amount: '', description: '', reference: '', transactionDate: new Date().toISOString().split('T')[0] });
    }
  };

  // Archive Account
  const handleArchiveAccount = async (accId: string) => {
    try {
      await fetch(`/api/v1/khata/accounts/${accId}/archive`, {
        method: 'POST',
        headers: { ...getAuthHeaders() }
      });
      await fetchAccounts();
    } catch {
      setAccounts((prev) => prev.map((a) => (a.id === accId ? { ...a, status: 'ARCHIVED' } : a)));
    }
  };

  // Reverse Transaction
  const handleReverseTransaction = async (txId: string) => {
    if (!selectedAccountId) return;
    try {
      const res = await fetch(`/api/v1/khata/accounts/${selectedAccountId}/transactions/${txId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reason: 'Manual Reversal from UI' })
      });
      if (res.ok) {
        setTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, status: 'REVERSED' } : t)));
        await fetchAccounts();
        await fetchTransactions(selectedAccountId);
      } else {
        setTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, status: 'REVERSED' } : t)));
      }
    } catch {
      setTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, status: 'REVERSED' } : t)));
    }
  };

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch = acc.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || (acc.phone && acc.phone.includes(searchQuery));
    const matchesFilter = filterType === 'ALL' || acc.accountType === filterType || (filterType === 'RECEIVABLE' && acc.statusText === 'RECEIVABLE') || (filterType === 'PAYABLE' && acc.statusText === 'PAYABLE');
    return matchesSearch && matchesFilter;
  });

  // Table Columns Definition
  const ledgerColumns: ColumnDef<KhataTransactionUI>[] = [
    {
      id: 'date',
      header: 'Date',
      accessor: (row) => new Date(row.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      width: 130
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (row) => {
        const isReversed = row.status === 'REVERSED';
        return (
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: isReversed ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: isReversed ? 'var(--color-negative)' : 'var(--color-positive)'
            }}
          >
            {isReversed ? 'REVERSED' : 'ACTIVE'}
          </span>
        );
      },
      width: 100
    },
    {
      id: 'description',
      header: 'Description',
      accessor: (row) => {
        const isReversed = row.status === 'REVERSED';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', textDecoration: isReversed ? 'line-through' : 'none', opacity: isReversed ? 0.6 : 1 }}>
            <span style={{ fontWeight: 500 }}>{row.description}</span>
            {row.reference && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Ref: {row.reference}</span>}
          </div>
        );
      },
      width: 230
    },
    {
      id: 'moneyIn',
      header: 'Money In (+)',
      numeric: true,
      accessor: (row) => {
        const isReversed = row.status === 'REVERSED';
        if (row.type !== 'MONEY_IN') return '—';
        return (
          <span style={{ color: isReversed ? 'var(--color-text-muted)' : 'var(--color-positive)', fontWeight: 600, textDecoration: isReversed ? 'line-through' : 'none' }}>
            ₹{row.amount}
          </span>
        );
      },
      width: 140
    },
    {
      id: 'moneyOut',
      header: 'Money Out (-)',
      numeric: true,
      accessor: (row) => {
        const isReversed = row.status === 'REVERSED';
        if (row.type !== 'MONEY_OUT') return '—';
        return (
          <span style={{ color: isReversed ? 'var(--color-text-muted)' : 'var(--color-negative)', fontWeight: 600, textDecoration: isReversed ? 'line-through' : 'none' }}>
            ₹{row.amount}
          </span>
        );
      },
      width: 140
    },
    {
      id: 'balance',
      header: 'Running Balance',
      numeric: true,
      accessor: (row) => <span style={{ fontWeight: 600, opacity: row.status === 'REVERSED' ? 0.6 : 1 }}>₹{row.runningBalance}</span>,
      width: 150
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: (row) => {
        if (row.status === 'REVERSED') {
          return <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Reversed</span>;
        }
        return (
          <IconButton
            icon={<Trash2 size={16} />}
            ariaLabel="Reverse transaction"
            variant="ghost"
            size="sm"
            onClick={() => handleReverseTransaction(row.id)}
          />
        );
      },
      width: 90
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Digital Khata"
        description="Accounts Receivable & Payable Ledger Management"
        phaseBadge="PHASE 5 — LIVE MODULE"
        actions={
          <button
            type="button"
            onClick={() => { setFormError(null); setIsAddAccountOpen(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '8px 16px',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <UserPlus size={16} />
            <span>Add Account</span>
          </button>
        }
      />

      {/* Summary Matrix Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-4)'
        }}
      >
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>TOTAL NET BALANCE</div>
          <div className="num-card" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginTop: 'var(--space-1)' }}>₹{summary.netBalance}</div>
        </div>

        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-positive)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpRight size={14} /> YOU WILL GET (RECEIVABLE)
          </div>
          <div className="num-card" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-positive)', marginTop: 'var(--space-1)' }}>₹{summary.totalReceivable}</div>
        </div>

        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-negative)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowDownLeft size={14} /> YOU WILL GIVE (PAYABLE)
          </div>
          <div className="num-card" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-negative)', marginTop: 'var(--space-1)' }}>₹{summary.totalPayable}</div>
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--space-6)', minHeight: '600px' }}>
        
        {/* Left Panel: Accounts List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)' }}>
          
          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0 10px' }}>
              <Search size={16} color="var(--color-text-muted)" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', padding: '8px', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 'var(--radius-md)', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
            >
              <option value="ALL">All</option>
              <option value="RECEIVABLE">Receivable</option>
              <option value="PAYABLE">Payable</option>
              <option value="CUSTOMER">Customer</option>
              <option value="SUPPLIER">Supplier</option>
            </select>
          </div>

          {/* Accounts List Container */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {isLoading ? (
              <LoadingState rows={4} />
            ) : filteredAccounts.length === 0 ? (
              <EmptyState title="No Accounts" description="Create a Khata account to start tracking transactions." />
            ) : (
              filteredAccounts.map((acc) => {
                const isSelected = acc.id === selectedAccountId;
                const isArchived = acc.status === 'ARCHIVED';
                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--color-bg-elevated)' : 'transparent',
                      border: isSelected ? '1px solid var(--color-brand-primary)' : '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                      opacity: isArchived ? 0.6 : 1,
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{acc.displayName}</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {isArchived && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-negative)' }}>
                            ARCHIVED
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-pill)',
                            backgroundColor: acc.statusText === 'RECEIVABLE' ? 'rgba(16, 185, 129, 0.15)' : acc.statusText === 'PAYABLE' ? 'rgba(244, 63, 94, 0.15)' : 'var(--color-bg-app)',
                            color: acc.statusText === 'RECEIVABLE' ? 'var(--color-positive)' : acc.statusText === 'PAYABLE' ? 'var(--color-negative)' : 'var(--color-text-muted)'
                          }}
                        >
                          {acc.statusText}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{acc.accountType}</span>
                      <span className="tabular-nums" style={{ fontWeight: 600 }}>₹{acc.netBalance}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Selected Account Ledger Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {selectedAccount ? (
            <>
              {/* Account Detail Header Strip */}
              <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{selectedAccount.displayName}</h2>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
                      {selectedAccount.accountType}
                    </span>
                    {selectedAccount.status === 'ARCHIVED' && (
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(244, 63, 94, 0.2)', color: 'var(--color-negative)' }}>
                        ARCHIVED
                      </span>
                    )}
                  </div>
                  {selectedAccount.phone && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {selectedAccount.phone}</div>}
                </div>

                {/* Posting & Archive Controls */}
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {selectedAccount.status === 'ARCHIVED' ? (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-negative)', padding: '6px 12px', backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>
                      Archived (Posting Disabled)
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { setActiveTxType('MONEY_IN'); setFormError(null); setIsAddTxOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'var(--color-positive)', color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
                      >
                        <ArrowUpRight size={16} />
                        <span>Give Money (+)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActiveTxType('MONEY_OUT'); setFormError(null); setIsAddTxOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'var(--color-negative)', color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
                      >
                        <ArrowDownLeft size={16} />
                        <span>Got Money (-)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleArchiveAccount(selectedAccount.id)}
                        style={{ padding: '8px 12px', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Archive
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Transaction Ledger Table */}
              <ResizableTable
                columns={ledgerColumns}
                data={transactions}
                keyExtractor={(row) => row.id}
                emptyTitle="No Ledger Transactions"
                emptyDescription="No transaction history posted for this account yet."
              />
            </>
          ) : (
            <EmptyState title="No Account Selected" description="Select an account from the left panel to view transactions." />
          )}
        </div>
      </div>

      {/* Modal: Add Account */}
      {isAddAccountOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 19, 28, 0.75)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>Create New Khata Account</h3>
              <IconButton icon={<X size={18} />} ariaLabel="Close modal" onClick={() => setIsAddAccountOpen(false)} />
            </div>

            {formError && <div style={{ color: 'var(--color-negative)', fontSize: 'var(--font-size-xs)' }}>{formError}</div>}

            <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Display Name *</label>
                <input type="text" required value={accountForm.displayName} onChange={(e) => setAccountForm({ ...accountForm, displayName: e.target.value })} style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Phone Number</label>
                <input type="text" value={accountForm.phone} onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })} style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Account Category</label>
                <select value={accountForm.accountType} onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value as any })} style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}>
                  <option value="CUSTOMER">Customer</option>
                  <option value="SUPPLIER">Supplier</option>
                  <option value="BUSINESS">Business</option>
                  <option value="PERSONAL">Personal</option>
                </select>
              </div>

              <button type="submit" style={{ marginTop: 'var(--space-2)', padding: '10px', backgroundColor: 'var(--color-brand-primary)', color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Save Account</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Transaction */}
      {isAddTxOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 19, 28, 0.75)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: activeTxType === 'MONEY_IN' ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                {activeTxType === 'MONEY_IN' ? 'Post Money In (+ Credit)' : 'Post Money Out (- Debit)'}
              </h3>
              <IconButton icon={<X size={18} />} ariaLabel="Close modal" onClick={() => setIsAddTxOpen(false)} />
            </div>

            {formError && <div style={{ color: 'var(--color-negative)', fontSize: 'var(--font-size-xs)' }}>{formError}</div>}

            <form onSubmit={handleCreateTransaction} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Amount (₹) *</label>
                <input type="number" step="0.0001" required value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} placeholder="0.0000" style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Description *</label>
                <input type="text" required value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} placeholder="e.g. Purchase bill / UPI payment" style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Reference (Optional)</label>
                <input type="text" value={txForm.reference} onChange={(e) => setTxForm({ ...txForm, reference: e.target.value })} placeholder="Voucher / Bill # / UPI Ref" style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} />
              </div>

              <button type="submit" style={{ marginTop: 'var(--space-2)', padding: '10px', backgroundColor: activeTxType === 'MONEY_IN' ? 'var(--color-positive)' : 'var(--color-negative)', color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Post Transaction</button>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
