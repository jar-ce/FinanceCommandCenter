import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/common/PageContainer';
import { EmptyState } from '../components/common/EmptyState';
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  Database,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Building,
  Layers
} from 'lucide-react';
import {
  MarketInstrumentRecord,
  MarketQuoteRecord,
  MarketCandle,
  MarketDataFreshness,
  MarketState
} from '@finance-command-center/shared-types';

export const StockDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [instrument, setInstrument] = useState<MarketInstrumentRecord | null>(null);
  const [quote, setQuote] = useState<MarketQuoteRecord | null>(null);
  const [history, setHistory] = useState<MarketCandle[]>([]);
  const [selectedInterval, setSelectedInterval] = useState<string>('1d');

  const [loading, setLoading] = useState<boolean>(true);
  const [quoteRefreshing, setQuoteRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstrumentData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Instrument Metadata
      const instRes = await fetch(`/api/v1/market/instruments/${id}`);
      if (!instRes.ok) {
        if (instRes.status === 404) {
          throw new Error('INSTRUMENT_NOT_FOUND');
        }
        throw new Error('Failed to load instrument master data');
      }
      const instData = await instRes.json();
      if (instData.success) {
        setInstrument(instData.data);
      } else {
        throw new Error(instData.error?.message || 'Instrument unavailable');
      }

      // 2. Fetch Latest Quote
      const quoteRes = await fetch(`/api/v1/market/instruments/${id}/quote`);
      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        if (quoteData.success) {
          setQuote(quoteData.data);
        }
      }

      // 3. Fetch Historical Candles
      const histRes = await fetch(`/api/v1/market/instruments/${id}/history?interval=${selectedInterval}`);
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData.success) {
          setHistory(histData.data || []);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch instrument details');
    } finally {
      setLoading(false);
    }
  };

  const refreshQuoteOnly = async () => {
    if (!id) return;
    setQuoteRefreshing(true);
    try {
      const quoteRes = await fetch(`/api/v1/market/instruments/${id}/quote`);
      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        if (quoteData.success) {
          setQuote(quoteData.data);
        }
      }
    } catch {
      // Retain existing view
    } finally {
      setQuoteRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInstrumentData();
  }, [id, selectedInterval]);

  const formatPrice = (priceStr?: string | null, currency: string = 'INR') => {
    if (!priceStr) return '—';
    const num = parseFloat(priceStr);
    if (isNaN(num)) return '—';
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatVolume = (vol?: number) => {
    if (vol === undefined || vol === null || vol === 0) return '—';
    return vol.toLocaleString('en-IN');
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  const getFreshnessBadge = (freshness?: MarketDataFreshness) => {
    switch (freshness) {
      case 'LIVE':
        return (
          <span style={{ padding: '3px 10px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700, fontSize: '0.75rem' }}>
            ● LIVE
          </span>
        );
      case 'EOD':
        return (
          <span style={{ padding: '3px 10px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>
            EOD CACHED
          </span>
        );
      case 'STALE':
        return (
          <span style={{ padding: '3px 10px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 700, fontSize: '0.75rem' }}>
            ▲ STALE DATA
          </span>
        );
      case 'UNAVAILABLE':
      default:
        return (
          <span style={{ padding: '3px 10px', borderRadius: '4px', background: 'rgba(100, 116, 139, 0.15)', color: '#94A3B8', border: '1px solid rgba(100, 116, 139, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>
            UNAVAILABLE
          </span>
        );
    }
  };

  const getMarketStateBadge = (state?: MarketState) => {
    switch (state) {
      case 'OPEN':
        return <span style={{ color: '#10B981', fontWeight: 600 }}>MARKET OPEN</span>;
      case 'CLOSED':
        return <span style={{ color: '#94A3B8', fontWeight: 600 }}>MARKET CLOSED</span>;
      case 'PRE_OPEN':
        return <span style={{ color: '#3B82F6', fontWeight: 600 }}>PRE-MARKET</span>;
      case 'POST_CLOSE':
        return <span style={{ color: '#A855F7', fontWeight: 600 }}>POST-MARKET</span>;
      case 'HALTED':
        return <span style={{ color: '#EF4444', fontWeight: 600 }}>TRADING HALTED</span>;
      default:
        return <span style={{ color: '#94A3B8', fontWeight: 600 }}>UNKNOWN SESSION</span>;
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '60px',
          textAlign: 'center',
          color: 'var(--color-text-muted)'
        }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 16px' }} />
          <div>Loading canonical security details & quote observation...</div>
        </div>
      </PageContainer>
    );
  }

  if (error === 'INSTRUMENT_NOT_FOUND' || !instrument) {
    return (
      <PageContainer>
        <button
          onClick={() => navigate('/stocks')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            padding: '6px 12px',
            borderRadius: '6px',
            marginBottom: '16px',
            cursor: 'pointer',
            fontSize: '0.8125rem'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Stock Search</span>
        </button>
        <EmptyState
          title="Instrument Not Found"
          description="The requested security ID does not exist in the canonical market database."
          icon={<Info size={36} color="var(--color-danger)" />}
        />
      </PageContainer>
    );
  }

  const isPositiveChange = quote?.change && parseFloat(quote.change) >= 0;
  const changeColor = isPositiveChange ? '#10B981' : '#EF4444';

  return (
    <PageContainer>
      {/* Back Button */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => navigate('/stocks')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            padding: '6px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 500
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Stock Search</span>
        </button>

        <button
          onClick={refreshQuoteOnly}
          disabled={quoteRefreshing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-surface-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            padding: '6px 14px',
            borderRadius: '6px',
            cursor: quoteRefreshing ? 'not-allowed' : 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 500
          }}
        >
          <RefreshCw size={14} className={quoteRefreshing ? 'animate-spin' : ''} />
          <span>{quoteRefreshing ? 'Refreshing Quote...' : 'Refresh Quote'}</span>
        </button>
      </div>

      {/* Header Banner */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                {instrument.symbol}
              </span>
              <span style={{ background: 'var(--color-brand-primary)', color: '#FFF', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                {instrument.exchange}
              </span>
              <span style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                {instrument.securityType}
              </span>
              {getFreshnessBadge(quote?.dataFreshness)}
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {instrument.displayName}
            </h1>
          </div>

          {/* Primary Quote Display */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
              {formatPrice(quote?.lastPrice, instrument.currency)}
            </div>
            {quote?.change !== undefined && quote?.change !== null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', fontSize: '0.9375rem', fontWeight: 700, color: changeColor, marginTop: '2px' }}>
                {isPositiveChange ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>{isPositiveChange ? '+' : ''}{parseFloat(quote.change).toFixed(2)}</span>
                <span>({isPositiveChange ? '+' : ''}{parseFloat(quote.changePercent).toFixed(2)}%)</span>
              </div>
            )}
          </div>
        </div>

        {/* Timestamps & Market Session Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary)',
          flexWrap: 'wrap'
        }}>
          <div>Session: {getMarketStateBadge(quote?.marketStatus)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} color="var(--color-text-muted)" />
            <span>Exchange Observation Time (asOf): <strong>{formatDate(quote?.asOf)}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={14} color="var(--color-text-muted)" />
            <span>APEX Retrieval Time (retrievedAt): <strong>{formatDate(quote?.retrievedAt)}</strong></span>
          </div>
        </div>
      </div>

      {/* Freshness & Stale Data Warnings */}
      {quote?.dataFreshness === 'STALE' && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#F59E0B',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.875rem'
        }}>
          <AlertTriangle size={20} />
          <div>
            <strong>STALE DATA NOTICE:</strong> The displayed market price is a cached historical observation. The data provider is currently unavailable or rate-limited; this price has not been updated live.
          </div>
        </div>
      )}

      {quote?.dataFreshness === 'UNAVAILABLE' && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.875rem'
        }}>
          <Info size={20} color="var(--color-text-muted)" />
          <div>
            <strong>PROVIDER UNREACHABLE:</strong> No live or cached quote observation is available from the development provider for this security. (Zero Fake Data Policy enforced)
          </div>
        </div>
      )}

      {/* Key Quote Statistics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Previous Close</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            {formatPrice(quote?.previousClose, instrument.currency)}
          </div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            {formatPrice(quote?.open, instrument.currency)}
          </div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>High</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#10B981', marginTop: '4px' }}>
            {formatPrice(quote?.high, instrument.currency)}
          </div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Low</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#EF4444', marginTop: '4px' }}>
            {formatPrice(quote?.low, instrument.currency)}
          </div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traded Volume</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            {formatVolume(quote?.volume)}
          </div>
        </div>
      </div>

      {/* Historical Price Chart Area */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="var(--color-brand-primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Historical Price Visualization
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['1d', '1w', '1m', '1y'].map((interval) => (
              <button
                key={interval}
                onClick={() => setSelectedInterval(interval)}
                style={{
                  background: selectedInterval === interval ? 'var(--color-brand-primary)' : 'var(--color-surface-hover)',
                  color: selectedInterval === interval ? '#FFF' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                {interval}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Component */}
        {history.length > 0 ? (
          <div style={{ height: '220px', width: '100%', position: 'relative', marginTop: '16px' }}>
            <svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="none">
              <path
                d={history.reduce((acc, point, idx) => {
                  const x = (idx / (history.length - 1)) * 580 + 10;
                  const price = parseFloat(point.close);
                  const minPrice = Math.min(...history.map(h => parseFloat(h.close)));
                  const maxPrice = Math.max(...history.map(h => parseFloat(h.close)));
                  const range = maxPrice - minPrice || 1;
                  const y = 180 - ((price - minPrice) / range) * 160;
                  return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="var(--color-brand-primary)"
                strokeWidth="2.5"
              />
            </svg>
          </div>
        ) : (
          <div style={{
            background: 'var(--color-surface-hover)',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '0.875rem'
          }}>
            <Layers size={28} color="var(--color-text-muted)" style={{ margin: '0 auto 8px' }} />
            <div>No historical price candles available from provider for interval {selectedInterval.toUpperCase()}.</div>
          </div>
        )}
      </div>

      {/* Security Master Metadata Drawer Card */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building size={18} color="var(--color-text-muted)" />
          <span>Security Reference Metadata</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '0.8125rem' }}>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>Internal Canonical UUID</div>
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '2px', wordBreak: 'break-all' }}>{instrument.id}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>Exchange Ticker Symbol</div>
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{instrument.symbol}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>Primary Exchange</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{instrument.exchange} ({instrument.market})</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>Security Instrument Class</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{instrument.securityType}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>Currency Denomination</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{instrument.currency}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>Data Provider Source</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{instrument.provider}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>Provider Instrument Ref</div>
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{instrument.providerInstrumentId || 'N/A'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>System Registration Date</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{formatDate(instrument.createdAt)}</div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
