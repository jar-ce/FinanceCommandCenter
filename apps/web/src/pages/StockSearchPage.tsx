import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { ResizableTable, ColumnDef } from '../components/common/ResizableTable';
import { Search, Filter, RefreshCw, Database, ShieldCheck, ArrowRight, Activity } from 'lucide-react';
import { MarketInstrumentRecord } from '@finance-command-center/shared-types';

export const StockSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [exchangeFilter, setExchangeFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [instruments, setInstruments] = useState<MarketInstrumentRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input (300ms)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const fetchInstruments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.append('query', debouncedQuery.trim());
      if (exchangeFilter) params.append('exchange', exchangeFilter);
      if (typeFilter) params.append('securityType', typeFilter);
      params.append('limit', '50');

      const res = await fetch(`/api/v1/market/instruments?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to query security master from server');
      }
      const data = await res.json();
      if (data.success) {
        setInstruments(data.data || []);
        if (data.meta) {
          setTotalCount(data.meta.totalCount || 0);
        }
      } else {
        setError(data.error?.message || 'Failed to search market instruments');
      }
    } catch (err: any) {
      setError(err.message || 'Market data service temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstruments();
  }, [debouncedQuery, exchangeFilter, typeFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>
            ACTIVE
          </span>
        );
      case 'SUSPENDED':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>
            SUSPENDED
          </span>
        );
      case 'DELISTED':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(100, 116, 139, 0.15)', color: '#94A3B8', border: '1px solid rgba(100, 116, 139, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>
            DELISTED
          </span>
        );
      default:
        return (
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.1)', color: '#94A3B8', fontSize: '0.75rem' }}>
            {status}
          </span>
        );
    }
  };

  const columns: ColumnDef<MarketInstrumentRecord>[] = [
    {
      id: 'symbol',
      header: 'Symbol',
      minWidth: 120,
      width: 140,
      accessor: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {row.symbol}
          </span>
        </div>
      )
    },
    {
      id: 'displayName',
      header: 'Instrument Name',
      minWidth: 220,
      width: 280,
      accessor: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.displayName}</div>
          {row.providerInstrumentId && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Ref: <span style={{ fontFamily: 'var(--font-mono)' }}>{row.providerInstrumentId}</span>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'exchange',
      header: 'Exchange / Market',
      minWidth: 140,
      width: 160,
      accessor: (row) => (
        <div style={{ fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-brand-primary)' }}>{row.exchange}</span>
          <span style={{ margin: '0 4px', color: 'var(--color-text-muted)' }}>•</span>
          <span style={{ color: 'var(--color-text-muted)' }}>{row.market}</span>
        </div>
      )
    },
    {
      id: 'securityType',
      header: 'Type',
      minWidth: 120,
      width: 130,
      accessor: (row) => (
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          background: 'var(--color-surface-hover)',
          padding: '2px 6px',
          borderRadius: '4px',
          color: 'var(--color-text-secondary)'
        }}>
          {row.securityType}
        </span>
      )
    },
    {
      id: 'currency',
      header: 'Currency',
      minWidth: 90,
      width: 100,
      numeric: true,
      accessor: (row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
          {row.currency}
        </span>
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
      id: 'provider',
      header: 'Data Source',
      minWidth: 140,
      width: 150,
      accessor: (row) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {row.provider}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Action',
      minWidth: 110,
      width: 120,
      numeric: true,
      accessor: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/stocks/${row.id}`);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#3B82F6',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background var(--transition-fast)'
          }}
        >
          <span>Details</span>
          <ArrowRight size={12} />
        </button>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Stock Search & Securities Master"
        description="Canonical Financial Security Registry & Research Desk"
        phaseBadge="PHASE 10 ACTIVE"
      />

      {/* System Status Banner */}
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
            <span>Master Registry: <strong>Canonical Security Database</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
            <Activity size={16} color="var(--color-brand-accent)" />
            <span>Results Found: <strong>{totalCount} Securities</strong></span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={16} color="#10B981" />
          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>
            ZERO FAKE DATA POLICY
          </span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--color-surface-hover)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          padding: '8px 14px',
          flex: '1 1 300px'
        }}>
          <Search size={16} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by symbol or company name (e.g. RELIANCE, TCS)..."
            value={query}
            onChange={handleQueryChange}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-primary)',
              outline: 'none',
              width: '100%',
              fontSize: '0.875rem'
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setDebouncedQuery('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              Clear
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="var(--color-text-muted)" />
          <select
            value={exchangeFilter}
            onChange={(e) => setExchangeFilter(e.target.value)}
            style={{
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              outline: 'none'
            }}
          >
            <option value="">All Exchanges</option>
            <option value="NSE">NSE (India)</option>
            <option value="BSE">BSE (India)</option>
            <option value="NASDAQ">NASDAQ (US)</option>
            <option value="NYSE">NYSE (US)</option>
            <option value="MUTUAL_FUND_IN">Mutual Funds (IN)</option>
            <option value="OTHER">Other Exchanges</option>
          </select>
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            background: 'var(--color-surface-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            outline: 'none'
          }}
        >
          <option value="">All Security Types</option>
          <option value="EQUITY">Equity Shares</option>
          <option value="ETF">ETFs</option>
          <option value="MUTUAL_FUND">Mutual Funds</option>
          <option value="INDEX">Indices</option>
          <option value="BOND">Bonds</option>
          <option value="DERIVATIVE">Derivatives</option>
          <option value="OTHER">Other Types</option>
        </select>
      </div>

      {/* Main Content View */}
      {loading ? (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--color-text-muted)'
        }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div>Querying canonical security master...</div>
        </div>
      ) : error ? (
        <EmptyState
          title="Security Master Search Error"
          description={error}
          icon={<Search size={36} color="var(--color-danger)" />}
        />
      ) : instruments.length === 0 ? (
        debouncedQuery || exchangeFilter || typeFilter ? (
          <EmptyState
            title="No Matching Securities Found"
            description="No instruments in the canonical security master matched your search criteria."
            icon={<Search size={36} color="var(--color-text-muted)" />}
          />
        ) : (
          <EmptyState
            title="Search Canonical Securities Master"
            description="Enter a symbol or instrument name above to search equity shares, ETFs, and indices registered in APEX OS."
            icon={<Search size={36} color="var(--color-brand-primary)" />}
          />
        )
      ) : (
        <ResizableTable
          columns={columns}
          data={instruments}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => navigate(`/stocks/${item.id}`)}
          emptyTitle="No Securities Available"
          emptyDescription="Security master dataset is empty."
        />
      )}
    </PageContainer>
  );
};
