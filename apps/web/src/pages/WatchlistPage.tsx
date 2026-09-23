import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { ResizableTable, ColumnDef } from '../components/common/ResizableTable';
import { EmptyState } from '../components/common/EmptyState';
import {
  Star,
  Plus,
  Trash2,
  Edit2,
  Archive,
  RotateCcw,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import {
  WatchlistRecord,
  WatchlistWithItemsRecord,
  WatchlistItemRecord,
  MarketInstrumentRecord,
  MarketDataFreshness,
  MarketState
} from '@finance-command-center/shared-types';

import { useAuth } from '../context/AuthContext';

export const WatchlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();

  // Watchlist state
  const [watchlists, setWatchlists] = useState<WatchlistRecord[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [activeWatchlist, setActiveWatchlist] = useState<WatchlistWithItemsRecord | null>(null);
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // UX states
  const [loading, setLoading] = useState<boolean>(true);
  const [itemsLoading, setItemsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newWatchlistName, setNewWatchlistName] = useState<string>('');
  const [newWatchlistDesc, setNewWatchlistDesc] = useState<string>('');

  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [renameValue, setRenameValue] = useState<string>('');

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MarketInstrumentRecord[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  // 1. Fetch User Watchlists
  const fetchWatchlists = async (preserveSelectedId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/watchlists?includeArchived=${showArchived}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch watchlists.');
      const data = await res.json();
      if (data.success) {
        setWatchlists(data.data || []);
        if (data.data.length > 0) {
          const targetId = preserveSelectedId || selectedWatchlistId || data.data[0].id;
          const exists = data.data.some((w: WatchlistRecord) => w.id === targetId);
          setSelectedWatchlistId(exists ? targetId : data.data[0].id);
        } else {
          setSelectedWatchlistId(null);
          setActiveWatchlist(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading watchlists.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Selected Watchlist Details & Items
  const fetchWatchlistDetails = async (id: string) => {
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/v1/watchlists/${id}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to load watchlist details.');
      const data = await res.json();
      if (data.success) {
        setActiveWatchlist(data.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching watchlist items.');
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlists();
  }, [showArchived]);

  useEffect(() => {
    if (selectedWatchlistId) {
      fetchWatchlistDetails(selectedWatchlistId);
    }
  }, [selectedWatchlistId]);

  // Create Watchlist Handler
  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchlistName.trim()) return;

    try {
      const res = await fetch('/api/v1/watchlists', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newWatchlistName.trim(),
          description: newWatchlistDesc.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateModalOpen(false);
        setNewWatchlistName('');
        setNewWatchlistDesc('');
        setActionSuccess(`Watchlist "${data.data.name}" created successfully.`);
        fetchWatchlists(data.data.id);
      } else {
        setError(data.error?.message || 'Failed to create watchlist.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error creating watchlist.');
    }
  };

  // Rename Watchlist Handler
  const handleRenameWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWatchlistId || !renameValue.trim()) return;

    try {
      const res = await fetch(`/api/v1/watchlists/${selectedWatchlistId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: renameValue.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setIsRenameModalOpen(false);
        setActionSuccess('Watchlist renamed successfully.');
        fetchWatchlists(selectedWatchlistId);
      } else {
        setError(data.error?.message || 'Failed to rename watchlist.');
      }
    } catch (err: any) {
      setError(err.message || 'Error renaming watchlist.');
    }
  };

  // Archive / Restore Watchlist Handler
  const handleToggleArchive = async () => {
    if (!activeWatchlist) return;
    const isArchived = activeWatchlist.status === 'ARCHIVED';
    const endpoint = `/api/v1/watchlists/${activeWatchlist.id}/${isArchived ? 'restore' : 'archive'}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Watchlist ${isArchived ? 'restored' : 'archived'} successfully.`);
        fetchWatchlists(activeWatchlist.id);
      } else {
        setError(data.error?.message || 'Failed to update watchlist status.');
      }
    } catch (err: any) {
      setError(err.message || 'Error archiving/restoring watchlist.');
    }
  };

  // Search Instruments for Add Modal
  useEffect(() => {
    if (!isAddModalOpen || !searchQuery.trim()) {
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
        // Silently handle search error
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isAddModalOpen]);

  // Add Item to Watchlist Handler
  const handleAddItem = async (instrumentId: string) => {
    if (!selectedWatchlistId) return;
    try {
      const res = await fetch(`/api/v1/watchlists/${selectedWatchlistId}/items`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ instrumentId })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Instrument added to watchlist.');
        fetchWatchlistDetails(selectedWatchlistId);
      } else {
        setError(data.error?.message || 'Failed to add instrument to watchlist.');
      }
    } catch (err: any) {
      setError(err.message || 'Error adding instrument.');
    }
  };

  // Remove Item Handler
  const handleRemoveItem = async (instrumentId: string) => {
    if (!selectedWatchlistId) return;
    try {
      const res = await fetch(`/api/v1/watchlists/${selectedWatchlistId}/items/${instrumentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Instrument removed from watchlist.');
        fetchWatchlistDetails(selectedWatchlistId);
      } else {
        setError(data.error?.message || 'Failed to remove instrument.');
      }
    } catch (err: any) {
      setError(err.message || 'Error removing instrument.');
    }
  };

  // Format Helpers
  const formatPrice = (priceStr?: string | null, currency: string = 'INR') => {
    if (!priceStr) return '—';
    const num = parseFloat(priceStr);
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

  const getMarketStateBadge = (state?: MarketState) => {
    switch (state) {
      case 'OPEN':
        return <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.75rem' }}>OPEN</span>;
      case 'CLOSED':
        return <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.75rem' }}>CLOSED</span>;
      case 'PRE_OPEN':
        return <span style={{ color: '#3B82F6', fontWeight: 600, fontSize: '0.75rem' }}>PRE-MARKET</span>;
      case 'POST_CLOSE':
        return <span style={{ color: '#A855F7', fontWeight: 600, fontSize: '0.75rem' }}>POST-MARKET</span>;
      default:
        return <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.75rem' }}>—</span>;
    }
  };

  // Table Columns Definition
  const columns: ColumnDef<WatchlistItemRecord>[] = [
    {
      id: 'symbol',
      header: 'Symbol',
      minWidth: 110,
      width: 140,
      accessor: (item: WatchlistItemRecord) => (
        <button
          onClick={() => navigate(`/stocks/${item.instrumentId}`)}
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
          {item.instrument?.symbol || '—'}
        </button>
      )
    },
    {
      id: 'displayName',
      header: 'Instrument Name',
      minWidth: 180,
      width: 260,
      accessor: (item: WatchlistItemRecord) => (
        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {item.instrument?.displayName || '—'}
        </div>
      )
    },
    {
      id: 'exchange',
      header: 'Exchange / Market',
      minWidth: 120,
      width: 150,
      accessor: (item: WatchlistItemRecord) => (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-surface-hover)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
          {item.instrument?.exchange} ({item.instrument?.market || 'IN'})
        </span>
      )
    },
    {
      id: 'securityType',
      header: 'Type',
      minWidth: 100,
      width: 120,
      accessor: (item: WatchlistItemRecord) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          {item.instrument?.securityType}
        </span>
      )
    },
    {
      id: 'lastPrice',
      header: 'Last Price',
      minWidth: 120,
      width: 150,
      numeric: true,
      accessor: (item: WatchlistItemRecord) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9375rem' }}>
          {formatPrice(item.quote?.lastPrice, item.instrument?.currency)}
        </div>
      )
    },
    {
      id: 'change',
      header: 'Change / %',
      minWidth: 140,
      width: 160,
      numeric: true,
      accessor: (item: WatchlistItemRecord) => {
        if (!item.quote?.change) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        const changeNum = parseFloat(item.quote.change);
        const changePctNum = parseFloat(item.quote.changePercent);
        const isPositive = changeNum >= 0;
        const color = isPositive ? '#10B981' : '#EF4444';

        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color, fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{isPositive ? '+' : ''}{changeNum.toFixed(2)} ({isPositive ? '+' : ''}{changePctNum.toFixed(2)}%)</span>
          </div>
        );
      }
    },
    {
      id: 'session',
      header: 'Session',
      minWidth: 100,
      width: 120,
      accessor: (item: WatchlistItemRecord) => getMarketStateBadge(item.quote?.marketStatus)
    },
    {
      id: 'freshness',
      header: 'Freshness',
      minWidth: 110,
      width: 130,
      accessor: (item: WatchlistItemRecord) => getFreshnessBadge(item.quote?.dataFreshness)
    },
    {
      id: 'actions',
      header: 'Actions',
      minWidth: 100,
      width: 110,
      accessor: (item: WatchlistItemRecord) => (
        <button
          onClick={() => handleRemoveItem(item.instrumentId)}
          title="Remove instrument from watchlist"
          disabled={activeWatchlist?.status === 'ARCHIVED'}
          style={{
            background: 'none',
            border: 'none',
            color: activeWatchlist?.status === 'ARCHIVED' ? 'var(--color-text-muted)' : 'var(--color-danger)',
            cursor: activeWatchlist?.status === 'ARCHIVED' ? 'not-allowed' : 'pointer',
            padding: '4px 8px',
            borderRadius: '4px'
          }}
        >
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  // Derived Summary Counts
  const items = activeWatchlist?.items || [];
  const liveCount = items.filter(i => i.quote?.dataFreshness === 'LIVE').length;
  const staleCount = items.filter(i => i.quote?.dataFreshness === 'STALE').length;
  const unavailableCount = items.filter(i => !i.quote || i.quote?.dataFreshness === 'UNAVAILABLE').length;

  return (
    <PageContainer>
      <PageHeader
        title="Watchlist Workspace"
        description="Personalized Security Monitor & Real-Time Market Feed"
        phaseBadge="PHASE 11"
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

      {/* Watchlist Controls Bar */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Select Watchlist:</label>
          <select
            value={selectedWatchlistId || ''}
            onChange={(e) => setSelectedWatchlistId(e.target.value)}
            disabled={watchlists.length === 0}
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
            {watchlists.map(w => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.itemCount || 0} items) {w.status === 'ARCHIVED' ? '[ARCHIVED]' : ''}
              </option>
            ))}
          </select>

          {activeWatchlist && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => { setRenameValue(activeWatchlist.name); setIsRenameModalOpen(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                <Edit2 size={14} />
                <span>Rename</span>
              </button>

              <button
                onClick={handleToggleArchive}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                {activeWatchlist.status === 'ARCHIVED' ? <RotateCcw size={14} /> : <Archive size={14} />}
                <span>{activeWatchlist.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</span>
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
            <span>New Watchlist</span>
          </button>

          {activeWatchlist && activeWatchlist.status !== 'ARCHIVED' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
            >
              <Plus size={16} />
              <span>Add Instrument</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics Strip */}
      {activeWatchlist && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Instruments</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{items.length}</div>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.75rem', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>● Live Quotes</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#10B981', marginTop: '2px' }}>{liveCount}</div>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.75rem', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>▲ Stale Cached</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#F59E0B', marginTop: '2px' }}>{staleCount}</div>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unavailable</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#94A3B8', marginTop: '2px' }}>{unavailableCount}</div>
          </div>
        </div>
      )}

      {/* Archived Notice Banner */}
      {activeWatchlist?.status === 'ARCHIVED' && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#F59E0B', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} />
          <div><strong>ARCHIVED WATCHLIST:</strong> This watchlist is archived and read-only. Click "Restore" to add or remove instruments.</div>
        </div>
      )}

      {/* Main Table / Empty States */}
      {loading ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div>Loading watchlists & market quotes...</div>
        </div>
      ) : watchlists.length === 0 ? (
        <EmptyState
          title="No Watchlists Found"
          description="You have not created any stock watchlists yet. Create your first watchlist to monitor real-time security prices."
          icon={<Star size={36} color="var(--color-brand-primary)" />}
          action={
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{ background: 'var(--color-brand-primary)', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Create First Watchlist
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Your Watchlist is Empty"
          description={`No market instruments are currently monitored in "${activeWatchlist?.name}". Add instruments to start tracking.`}
          icon={<Star size={36} color="var(--color-text-muted)" />}
          action={
            activeWatchlist?.status !== 'ARCHIVED' ? (
              <button
                onClick={() => setIsAddModalOpen(true)}
                style={{ background: 'var(--color-brand-primary)', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Add Instrument to Watchlist
              </button>
            ) : undefined
          }
        />
      ) : (
        <ResizableTable
          columns={columns}
          data={items}
          keyExtractor={(item: WatchlistItemRecord) => item.id}
          isLoading={itemsLoading}
          emptyTitle="No instruments in watchlist"
        />
      )}

      {/* MODAL 1: Create Watchlist */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', maxWidth: '450px', width: '100%', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '16px' }}>Create New Watchlist</h3>
            <form onSubmit={handleCreateWatchlist}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Watchlist Name *</label>
                <input
                  type="text"
                  required
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  placeholder="e.g. Core Tech Focus"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Description (Optional)</label>
                <input
                  type="text"
                  value={newWatchlistDesc}
                  onChange={(e) => setNewWatchlistDesc(e.target.value)}
                  placeholder="e.g. Large-cap technology securities"
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

      {/* MODAL 2: Rename Watchlist */}
      {isRenameModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', maxWidth: '450px', width: '100%', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '16px' }}>Rename Watchlist</h3>
            <form onSubmit={handleRenameWatchlist}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Watchlist Name *</label>
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

      {/* MODAL 3: Add Instrument Search Experience */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', maxWidth: '600px', width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Add Instrument to Watchlist</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
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
                placeholder="Search symbol or instrument name (e.g. RELIANCE, TCS)..."
                style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
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
                searchResults.map(inst => {
                  const alreadyInWatchlist = items.some(i => i.instrumentId === inst.id);

                  return (
                    <div
                      key={inst.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.9375rem' }}>{inst.symbol}</span>
                          <span style={{ background: 'var(--color-brand-primary)', color: '#FFF', padding: '1px 6px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 700 }}>{inst.exchange}</span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{inst.displayName}</div>
                      </div>

                      <button
                        onClick={() => handleAddItem(inst.id)}
                        disabled={alreadyInWatchlist}
                        style={{
                          background: alreadyInWatchlist ? 'var(--color-surface-hover)' : 'var(--color-brand-primary)',
                          color: alreadyInWatchlist ? 'var(--color-text-muted)' : '#FFF',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: alreadyInWatchlist ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {alreadyInWatchlist ? 'Added' : '+ Add'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
