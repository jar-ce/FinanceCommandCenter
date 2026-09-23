import React, { useState, useEffect } from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { ResizableTable, ColumnDef } from '../components/common/ResizableTable';
import { Flame, RefreshCw, Search, Filter, Calendar, ShieldCheck, Database, Info, X } from 'lucide-react';
import { IPOMasterRecord, IPOPipelineSummary } from '@finance-command-center/shared-types';

export const IpoPage: React.FC = () => {
  const [ipos, setIpos] = useState<IPOMasterRecord[]>([]);
  const [pipeline, setPipeline] = useState<IPOPipelineSummary>({ upcoming: 0, open: 0, closed: 0, listed: 0, total: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [exchangeFilter, setExchangeFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedIpo, setSelectedIpo] = useState<IPOMasterRecord | null>(null);

  const fetchIpos = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (exchangeFilter) params.append('exchange', exchangeFilter);
      if (typeFilter) params.append('issueType', typeFilter);

      const res = await fetch(`/api/v1/ipo?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch IPO data from server');
      }
      const data = await res.json();
      if (data.success) {
        setIpos(data.data || []);
        if (data.pipeline) {
          setPipeline(data.pipeline);
        }
      } else {
        setError(data.error?.message || 'Data unavailable');
      }
    } catch (err: any) {
      setError(err.message || 'IPO data temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIpos();
  }, [search, statusFilter, exchangeFilter, typeFilter]);

  const handleSync = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/v1/ipo/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchIpos();
      }
    } catch {
      // Retain existing view on failure
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (amountStr?: string | null) => {
    if (!amountStr) return 'Not Available';
    const num = parseFloat(amountStr);
    if (isNaN(num)) return 'Not Available';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'TBA';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'TBA';
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return 'TBA';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>OPEN</span>;
      case 'UPCOMING':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>UPCOMING</span>;
      case 'CLOSED':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(100, 116, 139, 0.15)', color: '#94A3B8', border: '1px solid rgba(100, 116, 139, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>CLOSED</span>;
      case 'LISTED':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)', color: '#A855F7', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>LISTED</span>;
      default:
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.1)', color: '#94A3B8', fontSize: '0.75rem' }}>{status}</span>;
    }
  };

  const columns: ColumnDef<IPOMasterRecord>[] = [
    {
      id: 'issuerName',
      header: 'Issuer & IPO Name',
      minWidth: 220,
      width: 260,
      accessor: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.issuerName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
            <span>{row.ipoName}</span>
            {row.symbol && <span style={{ background: 'var(--color-surface-hover)', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>{row.symbol}</span>}
          </div>
        </div>
      )
    },
    {
      id: 'exchange',
      header: 'Exchange / Type',
      minWidth: 140,
      width: 150,
      accessor: (row) => (
        <div style={{ fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{row.exchange}</span>
          <span style={{ margin: '0 4px', color: 'var(--color-text-muted)' }}>•</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{row.issueType}</span>
        </div>
      )
    },
    {
      id: 'status',
      header: 'Status',
      minWidth: 110,
      width: 120,
      accessor: (row) => getStatusBadge(row.status)
    },
    {
      id: 'priceBand',
      header: 'Price Band',
      minWidth: 150,
      width: 170,
      numeric: true,
      accessor: (row) => {
        if (!row.priceBandLow || !row.priceBandHigh) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>Not Available</span>;
        return (
          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            ₹{parseFloat(row.priceBandLow).toFixed(0)} – ₹{parseFloat(row.priceBandHigh).toFixed(0)}
          </span>
        );
      }
    },
    {
      id: 'lotSize',
      header: 'Lot Size',
      minWidth: 100,
      width: 110,
      numeric: true,
      accessor: (row) => (
        <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
          {row.lotSize ? `${row.lotSize} Shares` : 'Not Available'}
        </span>
      )
    },
    {
      id: 'maxLotCost',
      header: 'Max Lot Cost',
      minWidth: 130,
      width: 140,
      numeric: true,
      accessor: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-brand-primary)' }}>
          {formatCurrency(row.maxLotCost)}
        </span>
      )
    },
    {
      id: 'timeline',
      header: 'Offer Window',
      minWidth: 170,
      width: 190,
      accessor: (row) => (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          <div><span style={{ color: 'var(--color-text-muted)' }}>Open:</span> {formatDate(row.openDate)}</div>
          <div><span style={{ color: 'var(--color-text-muted)' }}>Close:</span> {formatDate(row.closeDate)}</div>
        </div>
      )
    },
    {
      id: 'actions',
      header: 'Action',
      minWidth: 100,
      width: 110,
      accessor: (row) => (
        <button
          onClick={() => setSelectedIpo(row)}
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#3B82F6',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Details
        </button>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="IPO Center"
        description="Canonical Initial Public Offerings Master Registry & Lifecycle Command Desk"
        phaseBadge="PHASE 6 ACTIVE"
      />

      {/* Freshness & Provenance Banner */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
            <Database size={16} color="var(--color-brand-primary)" />
            <span>Source: <strong>{ipos[0]?.source || 'System Default Feed'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
            <Calendar size={16} color="var(--color-text-muted)" />
            <span>Last Updated: <strong>{ipos[0]?.retrievedAt ? formatDate(ipos[0].retrievedAt) : 'Real-time Cached'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} color="#10B981" />
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>
              CANONICAL DATASET
            </span>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isRefreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-surface-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            opacity: isRefreshing ? 0.7 : 1
          }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Synchronizing...' : 'Sync Provider Data'}</span>
        </button>
      </div>

      {/* IPO Pipeline Stage Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3B82F6', marginTop: '4px' }}>{pipeline.upcoming}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open Now</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10B981', marginTop: '4px' }}>{pipeline.open}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#94A3B8', marginTop: '4px' }}>{pipeline.closed}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Listed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#A855F7', marginTop: '4px' }}>{pipeline.listed}</div>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '6px 12px', flex: '1 1 240px' }}>
          <Search size={16} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by issuer, IPO name, or symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', outline: 'none', width: '100%', fontSize: '0.875rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="var(--color-text-muted)" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8125rem', outline: 'none' }}
          >
            <option value="">All Statuses</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="LISTED">Listed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="POSTPONED">Postponed</option>
          </select>
        </div>

        <select
          value={exchangeFilter}
          onChange={(e) => setExchangeFilter(e.target.value)}
          style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8125rem', outline: 'none' }}
        >
          <option value="">All Exchanges</option>
          <option value="NSE">NSE</option>
          <option value="BSE">BSE</option>
          <option value="NSE_BSE">NSE & BSE</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8125rem', outline: 'none' }}
        >
          <option value="">All Types</option>
          <option value="MAINBOARD">Mainboard</option>
          <option value="SME">SME</option>
        </select>
      </div>

      {/* Main Table / States */}
      {loading ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px display' }} />
          <div>Loading canonical IPO records...</div>
        </div>
      ) : error ? (
        <EmptyState
          title="IPO Data Temporarily Unavailable"
          description={error}
          icon={<Info size={36} color="var(--color-danger)" />}
        />
      ) : ipos.length === 0 ? (
        search || statusFilter || exchangeFilter || typeFilter ? (
          <EmptyState
            title="No Matching IPO Records Found"
            description="No IPO records in the canonical registry match your active search filters."
            icon={<Search size={36} color="var(--color-text-muted)" />}
          />
        ) : (
          <EmptyState
            title="No IPO Data Currently Available"
            description="The canonical database is currently empty. Trigger provider synchronization or configure a public exchange data feed."
            icon={<Flame size={36} color="var(--color-warning)" />}
            action={
              <button
                onClick={handleSync}
                style={{
                  background: 'var(--color-brand-primary)',
                  color: '#FFF',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer'
                }}
              >
                Sync Provider Data
              </button>
            }
          />

        )
      ) : (
        <ResizableTable
          columns={columns}
          data={ipos}
          keyExtractor={(item) => item.id}
          emptyTitle="No IPO Records Available"
          emptyDescription="The database is empty."
        />
      )}

      {/* IPO Detail Modal / Drawer */}
      {selectedIpo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            position: 'relative'
          }}>
            <button
              onClick={() => setSelectedIpo(null)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{selectedIpo.issuerName}</h2>
              {getStatusBadge(selectedIpo.status)}
            </div>

            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              {selectedIpo.ipoName} {selectedIpo.symbol && `(${selectedIpo.symbol})`}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Exchange / Issue Type</div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{selectedIpo.exchange} • {selectedIpo.issueType}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Security Type</div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{selectedIpo.securityType}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Price Band</div>
                <div style={{ fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                  {selectedIpo.priceBandLow && selectedIpo.priceBandHigh ? `₹${selectedIpo.priceBandLow} – ₹${selectedIpo.priceBandHigh}` : 'Not Available'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Lot Size</div>
                <div style={{ fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                  {selectedIpo.lotSize ? `${selectedIpo.lotSize} Shares` : 'Not Available'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Max Lot Cost (Decimal.js)</div>
                <div style={{ fontWeight: 600, marginTop: '2px', color: 'var(--color-brand-primary)', fontFamily: 'monospace' }}>
                  {formatCurrency(selectedIpo.maxLotCost)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Issue Size</div>
                <div style={{ fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                  {formatCurrency(selectedIpo.issueSize)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Offer Window & Timeline</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.8125rem' }}>
                <div style={{ background: 'var(--color-surface-hover)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Open Date</div>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>{formatDate(selectedIpo.openDate)}</div>
                </div>
                <div style={{ background: 'var(--color-surface-hover)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Close Date</div>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>{formatDate(selectedIpo.closeDate)}</div>
                </div>
                <div style={{ background: 'var(--color-surface-hover)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Listing Date</div>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>{formatDate(selectedIpo.listingDate)}</div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <div>Provider: <strong>{selectedIpo.provider}</strong> ({selectedIpo.source})</div>
              <div>External ID: <strong>{selectedIpo.externalId || 'N/A'}</strong></div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
