import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { ResizableTable, ColumnDef } from '../components/common/ResizableTable';
import { EmptyState } from '../components/common/EmptyState';
import { Decimal } from 'decimal.js';
import {
  Briefcase,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  X,
  History,
  BarChart3,
  PieChart
} from 'lucide-react';
import {
  PortfolioRecord,
  PortfolioWithHoldingsRecord,
  PortfolioHoldingRecord,
  PortfolioTransactionRecord,
  MarketInstrumentRecord,
  MarketDataFreshness,
  PortfolioTransactionType,
  PnLSummaryRecord,
  HoldingPnLRecord,
  RealizedPnLRecord
} from '@finance-command-center/shared-types';

import { useAuth } from '../context/AuthContext';

export const PortfolioPage: React.FC = () => {
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();

  // Portfolio state
  const [portfolios, setPortfolios] = useState<PortfolioRecord[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [activePortfolio, setActivePortfolio] = useState<PortfolioWithHoldingsRecord | null>(null);
  const [transactions, setTransactions] = useState<PortfolioTransactionRecord[]>([]);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'holdings' | 'transactions' | 'pnl' | 'realized'>('holdings');

  // Phase 13 P&L State
  const [pnlSummary, setPnlSummary] = useState<PnLSummaryRecord | null>(null);
  const [holdingPnLList, setHoldingPnLList] = useState<HoldingPnLRecord[]>([]);
  const [realizedPnLList, setRealizedPnLList] = useState<RealizedPnLRecord[]>([]);
  const [pnlLoading, setPnlLoading] = useState<boolean>(false);
  const [datePreset, setDatePreset] = useState<'ALL' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'CUSTOM'>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // UX states
  const [loading, setLoading] = useState<boolean>(true);
  const [holdingsLoading, setHoldingsLoading] = useState<boolean>(false);
  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newPortfolioName, setNewPortfolioName] = useState<string>('');
  const [newPortfolioDesc, setNewPortfolioDesc] = useState<string>('');

  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [renameValue, setRenameValue] = useState<string>('');

  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [txType, setTxType] = useState<PortfolioTransactionType>('BUY');
  const [selectedInstrument, setSelectedInstrument] = useState<MarketInstrumentRecord | null>(null);
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [txQuantity, setTxQuantity] = useState<string>('');
  const [txPrice, setTxPrice] = useState<string>('');
  const [txCharges, setTxCharges] = useState<string>('0');
  const [txTaxes, setTxTaxes] = useState<string>('0');
  const [txRef, setTxRef] = useState<string>('');
  const [txNotes, setTxNotes] = useState<string>('');

  // Instrument Search Modal inside Add Transaction
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MarketInstrumentRecord[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  // 1. Fetch User Portfolios
  const fetchPortfolios = async (preserveSelectedId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/portfolios?includeArchived=${showArchived}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch portfolios.');
      const data = await res.json();
      if (data.success) {
        setPortfolios(data.data || []);
        if (data.data.length > 0) {
          const targetId = preserveSelectedId || selectedPortfolioId || data.data[0].id;
          const exists = data.data.some((p: PortfolioRecord) => p.id === targetId);
          setSelectedPortfolioId(exists ? targetId : data.data[0].id);
        } else {
          setSelectedPortfolioId(null);
          setActivePortfolio(null);
          setTransactions([]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading portfolios.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Selected Portfolio Details & Holdings
  const fetchPortfolioDetails = async (id: string) => {
    setHoldingsLoading(true);
    try {
      const res = await fetch(`/api/v1/portfolios/${id}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to load portfolio details.');
      const data = await res.json();
      if (data.success) {
        setActivePortfolio(data.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching portfolio holdings.');
    } finally {
      setHoldingsLoading(false);
    }
  };

  // 3. Fetch Transaction History
  const fetchTransactions = async (id: string) => {
    setTxLoading(true);
    try {
      const res = await fetch(`/api/v1/portfolios/${id}/transactions`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to load transaction history.');
      const data = await res.json();
      if (data.success) {
        setTransactions(data.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching transactions.');
    } finally {
      setTxLoading(false);
    }
  };

  // 4. Fetch P&L Analytics Data (Phase 13)
  const fetchPnLData = async (id: string, from?: string, to?: string) => {
    setPnlLoading(true);
    try {
      let queryStr = '';
      if (from || to) {
        const params = new URLSearchParams();
        if (from) params.append('fromDate', from);
        if (to) params.append('toDate', to);
        queryStr = `?${params.toString()}`;
      }

      const [resSummary, resHoldings, resRealized] = await Promise.all([
        fetch(`/api/v1/portfolios/${id}/pnl`, { headers: getAuthHeaders() }),
        fetch(`/api/v1/portfolios/${id}/pnl/holdings`, { headers: getAuthHeaders() }),
        fetch(`/api/v1/portfolios/${id}/pnl/realized${queryStr}`, { headers: getAuthHeaders() })
      ]);

      if (resSummary.ok) {
        const data = await resSummary.json();
        if (data.success) setPnlSummary(data.data);
      }
      if (resHoldings.ok) {
        const data = await resHoldings.json();
        if (data.success) setHoldingPnLList(data.data || []);
      }
      if (resRealized.ok) {
        const data = await resRealized.json();
        if (data.success) setRealizedPnLList(data.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching P&L analytics data.');
    } finally {
      setPnlLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolios();
  }, [showArchived]);

  useEffect(() => {
    if (selectedPortfolioId) {
      fetchPortfolioDetails(selectedPortfolioId);
      fetchTransactions(selectedPortfolioId);
      fetchPnLData(selectedPortfolioId, fromDate, toDate);
    }
  }, [selectedPortfolioId]);

  useEffect(() => {
    if (selectedPortfolioId && (activeTab === 'pnl' || activeTab === 'realized')) {
      fetchPnLData(selectedPortfolioId, fromDate, toDate);
    }
  }, [activeTab, fromDate, toDate]);

  // Create Portfolio Handler
  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    try {
      const res = await fetch('/api/v1/portfolios', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newPortfolioName.trim(),
          description: newPortfolioDesc.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateModalOpen(false);
        setNewPortfolioName('');
        setNewPortfolioDesc('');
        setActionSuccess(`Portfolio "${data.data.name}" created successfully.`);
        fetchPortfolios(data.data.id);
      } else {
        setError(data.error?.message || 'Failed to create portfolio.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error creating portfolio.');
    }
  };

  // Rename Portfolio Handler
  const handleRenamePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortfolioId || !renameValue.trim()) return;

    try {
      const res = await fetch(`/api/v1/portfolios/${selectedPortfolioId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: renameValue.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setIsRenameModalOpen(false);
        setActionSuccess('Portfolio renamed successfully.');
        fetchPortfolios(selectedPortfolioId);
      } else {
        setError(data.error?.message || 'Failed to rename portfolio.');
      }
    } catch (err: any) {
      setError(err.message || 'Error renaming portfolio.');
    }
  };

  // Archive / Restore Handler
  const handleToggleArchive = async () => {
    if (!activePortfolio) return;
    const isArchived = activePortfolio.status === 'ARCHIVED';
    const endpoint = `/api/v1/portfolios/${activePortfolio.id}/${isArchived ? 'restore' : 'archive'}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Portfolio ${isArchived ? 'restored' : 'archived'} successfully.`);
        fetchPortfolios(activePortfolio.id);
      } else {
        setError(data.error?.message || 'Failed to update portfolio status.');
      }
    } catch (err: any) {
      setError(err.message || 'Error archiving/restoring portfolio.');
    }
  };

  // Instrument Search Modal Logic
  useEffect(() => {
    if (!isSearchModalOpen || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/v1/market/instruments?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.data || []);
        }
      } catch {
        // Handle search error silently
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchModalOpen]);

  // Add Transaction Form Submission Handler
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortfolioId || !selectedInstrument) return;

    try {
      const res = await fetch(`/api/v1/portfolios/${selectedPortfolioId}/transactions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          instrumentId: selectedInstrument.id,
          transactionType: txType,
          transactionDate: new Date(txDate).toISOString(),
          quantity: txQuantity,
          price: txPrice,
          charges: txCharges || '0',
          taxes: txTaxes || '0',
          externalReference: txRef.trim() || undefined,
          notes: txNotes.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsTxModalOpen(false);
        setSelectedInstrument(null);
        setTxQuantity('');
        setTxPrice('');
        setTxCharges('0');
        setTxTaxes('0');
        setTxRef('');
        setTxNotes('');
        setActionSuccess(`Recorded ${txType} transaction for ${data.data.symbol}.`);
        fetchPortfolioDetails(selectedPortfolioId);
        fetchTransactions(selectedPortfolioId);
      } else {
        setError(data.error?.message || 'Failed to record transaction.');
      }
    } catch (err: any) {
      setError(err.message || 'Error recording portfolio transaction.');
    }
  };

  // Derived Preview Amounts via Decimal.js
  const calcPreviewAmounts = () => {
    try {
      const q = new Decimal(txQuantity || '0');
      const p = new Decimal(txPrice || '0');
      const c = new Decimal(txCharges || '0');
      const t = new Decimal(txTaxes || '0');

      if (q.isNegative() || p.isNegative()) return null;

      const gross = q.times(p);
      const total = txType === 'BUY' ? gross.plus(c).plus(t) : gross.minus(c).minus(t);

      return {
        gross: gross.toFixed(2),
        total: total.isNegative() ? '0.00' : total.toFixed(2)
      };
    } catch {
      return null;
    }
  };
  const previewAmounts = calcPreviewAmounts();

  // Selected Instrument's Current Available Quantity (for SELL preview)
  const targetHolding = selectedInstrument && activePortfolio
    ? activePortfolio.holdings.find(h => h.instrumentId === selectedInstrument.id)
    : null;
  const availableQty = targetHolding ? parseFloat(targetHolding.quantity) : 0;
  const isOversell = txType === 'SELL' && (parseFloat(txQuantity || '0') > availableQty);

  // Formatting Helpers
  const formatMoney = (valStr?: string | null, currency: string = 'INR') => {
    if (!valStr) return '—';
    const num = parseFloat(valStr);
    if (isNaN(num)) return '—';
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getFreshnessBadge = (freshness?: MarketDataFreshness) => {
    switch (freshness) {
      case 'LIVE':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700, fontSize: '0.6875rem' }}>
            ● LIVE
          </span>
        );
      case 'EOD':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, fontSize: '0.6875rem' }}>
            EOD
          </span>
        );
      case 'STALE':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 700, fontSize: '0.6875rem' }}>
            ▲ STALE
          </span>
        );
      case 'UNAVAILABLE':
      default:
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(100, 116, 139, 0.15)', color: '#94A3B8', border: '1px solid rgba(100, 116, 139, 0.3)', fontWeight: 600, fontSize: '0.6875rem' }}>
            UNAVAILABLE
          </span>
        );
    }
  };

  // Holdings Columns Definition
  const holdingsColumns: ColumnDef<PortfolioHoldingRecord>[] = [
    {
      id: 'symbol',
      header: 'Symbol',
      minWidth: 110,
      width: 130,
      accessor: (h: PortfolioHoldingRecord) => (
        <button
          onClick={() => navigate(`/stocks/${h.instrumentId}`)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-brand-primary)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            padding: 0,
            fontSize: '0.875rem',
            textAlign: 'left'
          }}
        >
          {h.symbol}
        </button>
      )
    },
    {
      id: 'displayName',
      header: 'Instrument Name',
      minWidth: 180,
      width: 240,
      accessor: (h: PortfolioHoldingRecord) => (
        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{h.displayName}</div>
      )
    },
    {
      id: 'exchange',
      header: 'Exchange',
      minWidth: 100,
      width: 120,
      accessor: (h: PortfolioHoldingRecord) => (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-surface-hover)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
          {h.exchange} ({h.market})
        </span>
      )
    },
    {
      id: 'quantity',
      header: 'Quantity',
      minWidth: 110,
      width: 130,
      numeric: true,
      accessor: (h: PortfolioHoldingRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          {parseFloat(h.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </div>
      )
    },
    {
      id: 'averageCost',
      header: 'Avg Cost',
      minWidth: 120,
      width: 140,
      numeric: true,
      accessor: (h: PortfolioHoldingRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(h.averageCost, h.currency)}</div>
      )
    },
    {
      id: 'totalAcquisitionCost',
      header: 'Acquisition Cost',
      minWidth: 140,
      width: 160,
      numeric: true,
      accessor: (h: PortfolioHoldingRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{formatMoney(h.totalAcquisitionCost, h.currency)}</div>
      )
    },
    {
      id: 'currentPrice',
      header: 'Current Price',
      minWidth: 120,
      width: 140,
      numeric: true,
      accessor: (h: PortfolioHoldingRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatMoney(h.currentPrice, h.currency)}</div>
      )
    },
    {
      id: 'marketValue',
      header: 'Market Value',
      minWidth: 140,
      width: 160,
      numeric: true,
      accessor: (h: PortfolioHoldingRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatMoney(h.marketValue, h.currency)}</div>
      )
    },
    {
      id: 'gainLoss',
      header: 'Unrealized Gain / %',
      minWidth: 160,
      width: 180,
      numeric: true,
      accessor: (h: PortfolioHoldingRecord) => {
        if (!h.unrealizedGainLoss || !h.unrealizedGainLossPercent) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        const diffNum = parseFloat(h.unrealizedGainLoss);
        const pctNum = parseFloat(h.unrealizedGainLossPercent);
        const isPositive = diffNum >= 0;
        const color = isPositive ? '#10B981' : '#EF4444';

        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color, fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{isPositive ? '+' : ''}{diffNum.toFixed(2)} ({isPositive ? '+' : ''}{pctNum.toFixed(2)}%)</span>
          </div>
        );
      }
    },
    {
      id: 'freshness',
      header: 'Freshness',
      minWidth: 110,
      width: 130,
      accessor: (h: PortfolioHoldingRecord) => getFreshnessBadge(h.dataFreshness)
    }
  ];

  // Transaction History Columns Definition
  const txColumns: ColumnDef<PortfolioTransactionRecord>[] = [
    {
      id: 'date',
      header: 'Date',
      minWidth: 140,
      width: 160,
      accessor: (tx: PortfolioTransactionRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
          {new Date(tx.transactionDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      )
    },
    {
      id: 'type',
      header: 'Type',
      minWidth: 90,
      width: 100,
      accessor: (tx: PortfolioTransactionRecord) => (
        <span style={{
          padding: '2px 8px',
          borderRadius: '4px',
          fontWeight: 800,
          fontSize: '0.6875rem',
          background: tx.transactionType === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: tx.transactionType === 'BUY' ? '#10B981' : '#EF4444',
          border: `1px solid ${tx.transactionType === 'BUY' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          {tx.transactionType}
        </span>
      )
    },
    {
      id: 'symbol',
      header: 'Symbol',
      minWidth: 110,
      width: 130,
      accessor: (tx: PortfolioTransactionRecord) => (
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{tx.symbol || '—'}</span>
      )
    },
    {
      id: 'quantity',
      header: 'Quantity',
      minWidth: 110,
      width: 130,
      numeric: true,
      accessor: (tx: PortfolioTransactionRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>
          {parseFloat(tx.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </div>
      )
    },
    {
      id: 'price',
      header: 'Execution Price',
      minWidth: 130,
      width: 150,
      numeric: true,
      accessor: (tx: PortfolioTransactionRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(tx.price)}</div>
      )
    },
    {
      id: 'grossAmount',
      header: 'Gross Amount',
      minWidth: 140,
      width: 160,
      numeric: true,
      accessor: (tx: PortfolioTransactionRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(tx.grossAmount)}</div>
      )
    },
    {
      id: 'fees',
      header: 'Charges / Taxes',
      minWidth: 130,
      width: 150,
      numeric: true,
      accessor: (tx: PortfolioTransactionRecord) => {
        const c = parseFloat(tx.charges || '0');
        const t = parseFloat(tx.taxes || '0');
        return <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{formatMoney((c + t).toString())}</div>;
      }
    },
    {
      id: 'totalAmount',
      header: 'Total Amount',
      minWidth: 140,
      width: 160,
      numeric: true,
      accessor: (tx: PortfolioTransactionRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatMoney(tx.totalAmount)}</div>
      )
    },
    {
      id: 'ref',
      header: 'Reference',
      minWidth: 120,
      width: 140,
      accessor: (tx: PortfolioTransactionRecord) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{tx.externalReference || '—'}</span>
      )
    }
  ];

  // Phase 13 Holding Analytics Columns Definition
  const pnlHoldingsColumns: ColumnDef<HoldingPnLRecord>[] = [
    {
      id: 'symbol',
      header: 'Symbol',
      minWidth: 110,
      width: 130,
      accessor: (h: HoldingPnLRecord) => (
        <button
          onClick={() => navigate(`/stocks/${h.instrumentId}`)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-brand-primary)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            padding: 0,
            fontSize: '0.875rem',
            textAlign: 'left'
          }}
        >
          {h.symbol}
        </button>
      )
    },
    {
      id: 'name',
      header: 'Instrument Name',
      minWidth: 160,
      width: 200,
      accessor: (h: HoldingPnLRecord) => (
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {h.displayName}
        </div>
      )
    },
    {
      id: 'quantity',
      header: 'Quantity',
      minWidth: 100,
      width: 120,
      numeric: true,
      accessor: (h: HoldingPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
          {parseFloat(h.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </div>
      )
    },
    {
      id: 'avgCost',
      header: 'Avg Cost',
      minWidth: 120,
      width: 130,
      numeric: true,
      accessor: (h: HoldingPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(h.averageCost, h.currency)}</div>
      )
    },
    {
      id: 'costBasis',
      header: 'Cost Basis',
      minWidth: 130,
      width: 140,
      numeric: true,
      accessor: (h: HoldingPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatMoney(h.totalAcquisitionCost, h.currency)}</div>
      )
    },
    {
      id: 'marketPrice',
      header: 'Market Price',
      minWidth: 120,
      width: 130,
      numeric: true,
      accessor: (h: HoldingPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(h.currentPrice, h.currency)}</div>
      )
    },
    {
      id: 'marketValue',
      header: 'Market Value',
      minWidth: 130,
      width: 140,
      numeric: true,
      accessor: (h: HoldingPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-primary)' }}>
          {formatMoney(h.marketValue, h.currency)}
        </div>
      )
    },
    {
      id: 'unrealizedPnL',
      header: 'Unrealized P&L',
      minWidth: 130,
      width: 150,
      numeric: true,
      accessor: (h: HoldingPnLRecord) => {
        if (!h.unrealizedPnL) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        const val = parseFloat(h.unrealizedPnL);
        const isPos = val >= 0;
        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: isPos ? '#10B981' : '#EF4444' }}>
            {isPos ? '+' : ''}{formatMoney(h.unrealizedPnL, h.currency)}
          </div>
        );
      }
    },
    {
      id: 'unrealizedPercent',
      header: 'Unrealized %',
      minWidth: 110,
      width: 120,
      numeric: true,
      accessor: (h: HoldingPnLRecord) => {
        if (!h.unrealizedPnLPercent) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        const val = parseFloat(h.unrealizedPnLPercent);
        const isPos = val >= 0;
        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: isPos ? '#10B981' : '#EF4444' }}>
            {isPos ? '+' : ''}{val.toFixed(2)}%
          </div>
        );
      }
    },
    {
      id: 'realizedPnL',
      header: 'Realized P&L',
      minWidth: 120,
      width: 140,
      numeric: true,
      accessor: (h: HoldingPnLRecord) => {
        const val = parseFloat(h.realizedPnL);
        const isPos = val >= 0;
        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: val === 0 ? 'var(--color-text-secondary)' : (isPos ? '#10B981' : '#EF4444') }}>
            {val > 0 ? '+' : ''}{formatMoney(h.realizedPnL, h.currency)}
          </div>
        );
      }
    },
    {
      id: 'freshness',
      header: 'Freshness',
      minWidth: 110,
      width: 120,
      accessor: (h: HoldingPnLRecord) => getFreshnessBadge(h.dataFreshness)
    }
  ];

  // Phase 13 Realized P&L Ledger Columns Definition
  const realizedPnLColumns: ColumnDef<RealizedPnLRecord>[] = [
    {
      id: 'date',
      header: 'Date',
      minWidth: 140,
      width: 160,
      accessor: (r: RealizedPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
          {new Date(r.transactionDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      )
    },
    {
      id: 'symbol',
      header: 'Symbol',
      minWidth: 110,
      width: 130,
      accessor: (r: RealizedPnLRecord) => (
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{r.symbol}</span>
      )
    },
    {
      id: 'soldQuantity',
      header: 'Sold Qty',
      minWidth: 100,
      width: 120,
      numeric: true,
      accessor: (r: RealizedPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>
          {parseFloat(r.soldQuantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </div>
      )
    },
    {
      id: 'price',
      header: 'SELL Price',
      minWidth: 120,
      width: 130,
      numeric: true,
      accessor: (r: RealizedPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(r.price)}</div>
      )
    },
    {
      id: 'grossProceeds',
      header: 'Gross Proceeds',
      minWidth: 130,
      width: 140,
      numeric: true,
      accessor: (r: RealizedPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(r.grossProceeds)}</div>
      )
    },
    {
      id: 'fees',
      header: 'Charges / Taxes',
      minWidth: 130,
      width: 140,
      numeric: true,
      accessor: (r: RealizedPnLRecord) => {
        const c = parseFloat(r.charges || '0');
        const t = parseFloat(r.taxes || '0');
        return <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{formatMoney((c + t).toString())}</div>;
      }
    },
    {
      id: 'netProceeds',
      header: 'Net Proceeds',
      minWidth: 130,
      width: 140,
      numeric: true,
      accessor: (r: RealizedPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatMoney(r.netProceeds)}</div>
      )
    },
    {
      id: 'avgCost',
      header: 'Avg Cost',
      minWidth: 120,
      width: 130,
      numeric: true,
      accessor: (r: RealizedPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{formatMoney(r.averageCostBeforeSell)}</div>
      )
    },
    {
      id: 'costRemoved',
      header: 'Cost Basis Removed',
      minWidth: 140,
      width: 150,
      numeric: true,
      accessor: (r: RealizedPnLRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(r.costRemoved)}</div>
      )
    },
    {
      id: 'realizedPnL',
      header: 'Realized P&L',
      minWidth: 140,
      width: 160,
      numeric: true,
      accessor: (r: RealizedPnLRecord) => {
        const val = parseFloat(r.realizedPnL);
        const isPos = val >= 0;
        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: isPos ? '#10B981' : '#EF4444' }}>
            {isPos ? '+' : ''}{formatMoney(r.realizedPnL)}
          </div>
        );
      }
    }
  ];

  // Summary Metrics
  const holdings = activePortfolio?.holdings || [];
  let totalMarketValue = new Decimal(0);
  let totalCostBasis = new Decimal(0);
  let hasValidMarketValue = false;

  for (const h of holdings) {
    totalCostBasis = totalCostBasis.plus(new Decimal(h.totalAcquisitionCost));
    if (h.marketValue) {
      totalMarketValue = totalMarketValue.plus(new Decimal(h.marketValue));
      hasValidMarketValue = true;
    }
  }

  const liveCount = holdings.filter(h => h.dataFreshness === 'LIVE').length;
  const staleCount = holdings.filter(h => h.dataFreshness === 'STALE').length;
  const unavailableCount = holdings.filter(h => h.dataFreshness === 'UNAVAILABLE').length;

  return (
    <PageContainer>
      <PageHeader
        title="Portfolio Workspace"
        description="Investment Holdings & Transaction Ledger Architecture"
        phaseBadge="PHASE 12"
      />

      {/* Notifications */}
      {actionSuccess && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10B981', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
            <CheckCircle2 size={18} />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Portfolio Controls Toolbar */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Select Portfolio:</label>
          <select
            value={selectedPortfolioId || ''}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedPortfolioId(id);
              fetchPortfolioDetails(id);
              fetchTransactions(id);
            }}
            disabled={portfolios.length === 0}
            style={{
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              minWidth: '200px'
            }}
          >
            {portfolios.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.holdingCount || 0} holdings) {p.status === 'ARCHIVED' ? '[ARCHIVED]' : ''}
              </option>
            ))}
          </select>

          {activePortfolio && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => { setRenameValue(activePortfolio.name); setIsRenameModalOpen(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                <Edit2 size={14} />
                <span>Rename</span>
              </button>

              <button
                onClick={handleToggleArchive}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                {activePortfolio.status === 'ARCHIVED' ? <RotateCcw size={14} /> : <Archive size={14} />}
                <span>{activePortfolio.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>Show Archived</span>
          </label>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-brand-primary)', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
          >
            <Plus size={16} />
            <span>New Portfolio</span>
          </button>

          {activePortfolio && activePortfolio.status !== 'ARCHIVED' && (
            <button
              onClick={() => { setSelectedInstrument(null); setIsTxModalOpen(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
            >
              <Plus size={16} />
              <span>Add Transaction</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics Strip */}
      {activePortfolio && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Holdings</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{holdings.length}</div>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cost Basis</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{formatMoney(totalCostBasis.toFixed(4))}</div>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market Value</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-brand-primary)', marginTop: '2px' }}>
              {hasValidMarketValue ? formatMoney(totalMarketValue.toFixed(4)) : '—'}
            </div>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quote Freshness</div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginTop: '4px', display: 'flex', gap: '8px' }}>
              <span style={{ color: '#10B981' }}>● {liveCount} Live</span>
              <span style={{ color: '#F59E0B' }}>▲ {staleCount} Stale</span>
              <span style={{ color: '#94A3B8' }}>{unavailableCount} Unavail</span>
            </div>
          </div>
        </div>
      )}

      {/* Archived Warning Banner */}
      {activePortfolio?.status === 'ARCHIVED' && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#F59E0B', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} />
          <div><strong>ARCHIVED PORTFOLIO:</strong> This portfolio is archived and read-only. Click "Restore" to record new transactions.</div>
        </div>
      )}

      {/* Workspace Tabs */}
      {activePortfolio && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '20px', gap: '20px' }}>
          <button
            onClick={() => setActiveTab('holdings')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'holdings' ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
              color: activeTab === 'holdings' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              padding: '8px 4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9375rem'
            }}
          >
            <Briefcase size={16} />
            <span>Active Holdings ({holdings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'transactions' ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
              color: activeTab === 'transactions' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              padding: '8px 4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9375rem'
            }}
          >
            <History size={16} />
            <span>Transaction History ({transactions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pnl')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'pnl' ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
              color: activeTab === 'pnl' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              padding: '8px 4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9375rem'
            }}
          >
            <BarChart3 size={16} />
            <span>P&L Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('realized')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'realized' ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
              color: activeTab === 'realized' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
              fontWeight: 700,
              padding: '8px 4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9375rem'
            }}
          >
            <PieChart size={16} />
            <span>Realized P&L Ledger ({realizedPnLList.length})</span>
          </button>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div>Loading portfolios & transaction ledger...</div>
        </div>
      ) : portfolios.length === 0 ? (
        <EmptyState
          title="No Portfolios Found"
          description="You have not created any investment portfolios yet. Create your first portfolio to start tracking holdings and transactions."
          icon={<Briefcase size={36} color="var(--color-brand-primary)" />}
          action={
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{ background: 'var(--color-brand-primary)', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Create First Portfolio
            </button>
          }
        />
      ) : activeTab === 'holdings' ? (
        holdings.length === 0 ? (
          <EmptyState
            title="No Active Holdings"
            description={`No security holdings are currently held in "${activePortfolio?.name}". Record a BUY transaction to build holdings.`}
            icon={<Briefcase size={36} color="var(--color-text-muted)" />}
            action={
              activePortfolio?.status !== 'ARCHIVED' ? (
                <button
                  onClick={() => { setSelectedInstrument(null); setIsTxModalOpen(true); }}
                  style={{ background: 'var(--color-brand-primary)', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Add First Transaction
                </button>
              ) : undefined
            }
          />
        ) : (
          <ResizableTable
            columns={holdingsColumns}
            data={holdings}
            keyExtractor={(h: PortfolioHoldingRecord) => h.instrumentId}
            isLoading={holdingsLoading}
            emptyTitle="No active holdings"
          />
        )
      ) : activeTab === 'transactions' ? (
        transactions.length === 0 ? (
          <EmptyState
            title="No Transaction History"
            description={`No BUY or SELL transactions have been recorded for "${activePortfolio?.name}".`}
            icon={<History size={36} color="var(--color-text-muted)" />}
          />
        ) : (
          <ResizableTable
            columns={txColumns}
            data={transactions}
            keyExtractor={(tx: PortfolioTransactionRecord) => tx.id}
            isLoading={txLoading}
            emptyTitle="No transaction history"
          />
        )
      ) : activeTab === 'pnl' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* P&L Performance Summary Cards */}
          {pnlSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Realized P&L</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: '2px', color: parseFloat(pnlSummary.realizedPnL) >= 0 ? '#10B981' : '#EF4444' }}>
                  {parseFloat(pnlSummary.realizedPnL) >= 0 ? '+' : ''}{formatMoney(pnlSummary.realizedPnL)}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unrealized P&L</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: '2px', color: parseFloat(pnlSummary.unrealizedPnL) >= 0 ? '#10B981' : '#EF4444' }}>
                  {parseFloat(pnlSummary.unrealizedPnL) >= 0 ? '+' : ''}{formatMoney(pnlSummary.unrealizedPnL)}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Portfolio P&L</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: '2px', color: parseFloat(pnlSummary.totalPnL) >= 0 ? '#10B981' : '#EF4444' }}>
                  {parseFloat(pnlSummary.totalPnL) >= 0 ? '+' : ''}{formatMoney(pnlSummary.totalPnL)}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>XIRR Return</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {pnlSummary.returnMetrics.xirrStatus === 'CALCULATED' && pnlSummary.returnMetrics.xirrPercent ? `${pnlSummary.returnMetrics.xirrPercent}%` : 'UNAVAILABLE'}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valuation Coverage</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{pnlSummary.valuationCoverage.valuedHoldingsCount} / {pnlSummary.valuationCoverage.totalHoldingsCount} Valued</span>
                  {getFreshnessBadge(pnlSummary.valuationCoverage.overallFreshness)}
                </div>
              </div>
            </div>
          )}

          {holdingPnLList.length === 0 ? (
            <EmptyState
              title="No Active Holdings for Analytics"
              description="No active security holdings exist in this portfolio. Record a BUY transaction to build holdings analytics."
              icon={<BarChart3 size={36} color="var(--color-text-muted)" />}
            />
          ) : (
            <ResizableTable
              columns={pnlHoldingsColumns}
              data={holdingPnLList}
              keyExtractor={(h: HoldingPnLRecord) => h.instrumentId}
              isLoading={pnlLoading}
              emptyTitle="No holding analytics"
            />
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Realized P&L Date Range Selector Bar */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Time Range:</span>
              {(['ALL', '1W', '1M', '3M', '6M', '1Y', 'CUSTOM'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setDatePreset(preset);
                    if (preset === 'ALL') {
                      setFromDate('');
                      setToDate('');
                    } else if (preset !== 'CUSTOM') {
                      const now = new Date();
                      const from = new Date();
                      if (preset === '1W') from.setDate(now.getDate() - 7);
                      if (preset === '1M') from.setMonth(now.getMonth() - 1);
                      if (preset === '3M') from.setMonth(now.getMonth() - 3);
                      if (preset === '6M') from.setMonth(now.getMonth() - 6);
                      if (preset === '1Y') from.setFullYear(now.getFullYear() - 1);
                      setFromDate(from.toISOString().slice(0, 10));
                      setToDate(now.toISOString().slice(0, 10));
                    }
                  }}
                  style={{
                    background: datePreset === preset ? 'var(--color-brand-primary)' : 'var(--color-surface-hover)',
                    color: datePreset === preset ? '#FFF' : 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>

            {datePreset === 'CUSTOM' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}
                />
              </div>
            )}
          </div>

          {realizedPnLList.length === 0 ? (
            <EmptyState
              title="No Realized P&L Ledger Records"
              description="No SELL transactions have been recorded for this portfolio within the selected time range."
              icon={<PieChart size={36} color="var(--color-text-muted)" />}
            />
          ) : (
            <ResizableTable
              columns={realizedPnLColumns}
              data={realizedPnLList}
              keyExtractor={(r: RealizedPnLRecord) => r.transactionId}
              isLoading={pnlLoading}
              emptyTitle="No realized P&L records"
            />
          )}
        </div>
      )}

      {/* MODAL 1: Create Portfolio */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', maxWidth: '450px', width: '100%', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '16px' }}>Create New Portfolio</h3>
            <form onSubmit={handleCreatePortfolio}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Portfolio Name *</label>
                <input
                  type="text"
                  required
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  placeholder="e.g. Core Long-Term Equities"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Description (Optional)</label>
                <input
                  type="text"
                  value={newPortfolioDesc}
                  onChange={(e) => setNewPortfolioDesc(e.target.value)}
                  placeholder="e.g. Retirement & strategic equity holdings"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--color-brand-primary)', color: '#FFF', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Rename Portfolio */}
      {isRenameModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', maxWidth: '450px', width: '100%', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '16px' }}>Rename Portfolio</h3>
            <form onSubmit={handleRenamePortfolio}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Portfolio Name *</label>
                <input
                  type="text"
                  required
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--color-brand-primary)', color: '#FFF', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Save Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Transaction Modal */}
      {isTxModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', maxWidth: '540px', width: '100%', margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Record Portfolio Transaction</h3>
              <button onClick={() => setIsTxModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTransaction}>
              {/* BUY / SELL Switcher */}
              <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '4px', borderRadius: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setTxType('BUY')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: txType === 'BUY' ? '#10B981' : 'none',
                    color: txType === 'BUY' ? '#FFF' : 'var(--color-text-secondary)'
                  }}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('SELL')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: txType === 'SELL' ? '#EF4444' : 'none',
                    color: txType === 'SELL' ? '#FFF' : 'var(--color-text-secondary)'
                  }}
                >
                  SELL
                </button>
              </div>

              {/* Instrument Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Canonical Instrument *</label>
                {selectedInstrument ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '10px 12px' }}>
                    <div>
                      <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{selectedInstrument.symbol}</span>
                      <span style={{ marginLeft: '8px', color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{selectedInstrument.displayName} ({selectedInstrument.exchange})</span>
                    </div>
                    <button type="button" onClick={() => setSelectedInstrument(null)} style={{ background: 'none', border: 'none', color: 'var(--color-brand-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px border-dashed var(--color-brand-primary)', background: 'rgba(59, 130, 246, 0.05)', color: 'var(--color-brand-primary)', fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}
                  >
                    + Search & Select Market Instrument
                  </button>
                )}
              </div>

              {/* Available Qty Warning for SELL */}
              {txType === 'SELL' && selectedInstrument && (
                <div style={{ background: isOversell ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', border: `1px solid ${isOversell ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`, color: isOversell ? '#EF4444' : '#3B82F6', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px', fontSize: '0.8125rem' }}>
                  <strong>Currently Available:</strong> {availableQty.toFixed(4)} shares. {isOversell ? '⚠️ Requested SELL quantity exceeds available holding.' : ''}
                </div>
              )}

              {/* Transaction Date */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Transaction Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                />
              </div>

              {/* Quantity & Price Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Quantity *</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    placeholder="e.g. 10.00"
                    value={txQuantity}
                    onChange={(e) => setTxQuantity(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Execution Price (₹) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    placeholder="e.g. 150.25"
                    value={txPrice}
                    onChange={(e) => setTxPrice(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              {/* Charges & Taxes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Brokerage / Charges (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={txCharges}
                    onChange={(e) => setTxCharges(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>STT / Taxes (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={txTaxes}
                    onChange={(e) => setTxTaxes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              {/* Amount Breakdown Preview */}
              {previewAmounts && (
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px', marginBottom: '16px', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Gross Amount:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>₹{previewAmounts.gross}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9375rem', color: txType === 'BUY' ? '#10B981' : '#3B82F6' }}>
                    <span>{txType === 'BUY' ? 'Total Acquisition Cost:' : 'Net Proceeds:'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{previewAmounts.total}</span>
                  </div>
                </div>
              )}

              {/* External Ref & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Ref / Order ID</label>
                  <input
                    type="text"
                    placeholder="e.g. ORD-109283"
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. SIP allocation"
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedInstrument || isOversell}
                  style={{
                    background: isOversell ? 'var(--color-surface-hover)' : txType === 'BUY' ? '#10B981' : '#EF4444',
                    color: isOversell ? 'var(--color-text-muted)' : '#FFF',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    cursor: isOversell ? 'not-allowed' : 'pointer',
                    fontWeight: 700
                  }}
                >
                  Record {txType} Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Instrument Search Modal */}
      {isSearchModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', maxWidth: '550px', width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Search Security Master</h3>
              <button onClick={() => setIsSearchModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol or instrument name (e.g. TATASTEEL, HDFCBANK)..."
                style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              {searchLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  <div>Searching canonical security master...</div>
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  {searchQuery.trim() ? 'No matching canonical instruments found.' : 'Type a symbol or company name to search.'}
                </div>
              ) : (
                searchResults.map(inst => (
                  <div
                    key={inst.id}
                    onClick={() => {
                      setSelectedInstrument(inst);
                      setIsSearchModalOpen(false);
                    }}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--color-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: 'var(--color-surface)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.9375rem' }}>{inst.symbol}</span>
                        <span style={{ background: 'var(--color-brand-primary)', color: '#FFF', padding: '1px 6px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 700 }}>{inst.exchange}</span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{inst.displayName}</div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-brand-primary)', fontWeight: 600 }}>Select</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
