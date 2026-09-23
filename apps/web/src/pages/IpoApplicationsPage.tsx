import React, { useState, useEffect } from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { ResizableTable, ColumnDef } from '../components/common/ResizableTable';
import { Plus, RefreshCw, Search, Filter, ShieldCheck, X, FileText } from 'lucide-react';
import { IPOApplicationRecord, IPOApplicationSummary, IPOMasterRecord } from '@finance-command-center/shared-types';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface KhataAccountOption {
  id: string;
  displayName: string;
  accountType: string;
}

export const IpoApplicationsPage: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [applications, setApplications] = useState<IPOApplicationRecord[]>([]);
  const [summary, setSummary] = useState<IPOApplicationSummary>({
    total: 0,
    draft: 0,
    submitted: 0,
    paymentPending: 0,
    paymentConfirmed: 0,
    completed: 0,
    cancelled: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal & Detail state
  const [selectedApp, setSelectedApp] = useState<IPOApplicationRecord | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form state
  const [availableIpos, setAvailableIpos] = useState<IPOMasterRecord[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<KhataAccountOption[]>([]);
  const [selectedIpoId, setSelectedIpoId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [applicationDate, setApplicationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lotsApplied, setLotsApplied] = useState<number>(1);
  const [quantityApplied, setQuantityApplied] = useState<number>(1);
  const [applicationAmount, setApplicationAmount] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/v1/ipo/applications?${params.toString()}`, {
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch IPO applications');
      }
      const data = await res.json();
      if (data.success) {
        setApplications(data.data || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        setError(data.error?.message || 'Data unavailable');
      }
    } catch (err: any) {
      setError(err.message || 'Applications temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  const fetchFormOptions = async () => {
    try {
      const [ipoRes, accRes] = await Promise.all([
        fetch('/api/v1/ipo'),
        fetch('/api/v1/khata/accounts', {
          headers: { ...getAuthHeaders() }
        })
      ]);

      if (ipoRes.ok) {
        const ipoData = await ipoRes.json();
        if (ipoData.success) {
          setAvailableIpos(ipoData.data || []);
        }
      }

      if (accRes.ok) {
        const accData = await accRes.json();
        if (accData.success) {
          setAvailableAccounts(accData.data || []);
        }
      }
    } catch {
      // Form options fallback
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [search, statusFilter]);

  useEffect(() => {
    fetchFormOptions();
  }, []);

  // Update quantity and estimated amount when IPO or Lots change
  useEffect(() => {
    if (!selectedIpoId) return;
    const ipo = availableIpos.find(i => i.id === selectedIpoId);
    if (!ipo) return;

    const lotSize = ipo.lotSize && ipo.lotSize > 0 ? ipo.lotSize : 1;
    const computedQty = lotsApplied * lotSize;
    setQuantityApplied(computedQty);

    if (ipo.priceBandHigh) {
      const price = parseFloat(ipo.priceBandHigh);
      if (!isNaN(price)) {
        setApplicationAmount((price * computedQty).toFixed(4));
      }
    }
  }, [selectedIpoId, lotsApplied, availableIpos]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedIpoId) {
      setFormError('Please select an IPO from the canonical master list.');
      return;
    }

    if (!selectedAccountId) {
      setFormError('Please select an Application Account.');
      return;
    }

    if (lotsApplied <= 0) {
      setFormError('Lots applied must be at least 1.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/ipo/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          ipoId: selectedIpoId,
          applicationAccountId: selectedAccountId,
          applicationDate: new Date(applicationDate).toISOString(),
          lotsApplied,
          quantityApplied,
          applicationAmount: applicationAmount || undefined,
          paymentReference: paymentReference || undefined,
          notes: notes || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to record IPO application');
      }

      setIsCreateModalOpen(false);
      resetForm();
      await fetchApplications();
    } catch (err: any) {
      setFormError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusTransition = async (appId: string, targetStatus: string) => {
    try {
      const res = await fetch(`/api/v1/ipo/applications/${appId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: targetStatus })
      });

      const data = await res.json();
      if (data.success) {
        if (selectedApp && selectedApp.id === appId) {
          setSelectedApp(data.data);
        }
        await fetchApplications();
      }
    } catch {
      // Keep view on error
    }
  };

  const resetForm = () => {
    setSelectedIpoId('');
    setSelectedAccountId('');
    setLotsApplied(1);
    setQuantityApplied(1);
    setApplicationAmount('');
    setPaymentReference('');
    setNotes('');
    setFormError(null);
  };

  const formatCurrency = (amountStr?: string | null) => {
    if (!amountStr) return '₹0.00';
    const num = parseFloat(amountStr);
    if (isNaN(num)) return '₹0.00';
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
      case 'SUBMITTED':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>SUBMITTED</span>;
      case 'PAYMENT_PENDING':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>PAYMENT PENDING</span>;
      case 'PAYMENT_CONFIRMED':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>PAYMENT CONFIRMED</span>;
      case 'COMPLETED':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)', color: '#A855F7', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>COMPLETED</span>;
      case 'CANCELLED':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>CANCELLED</span>;
      case 'DRAFT':
      default:
        return <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.15)', color: '#94A3B8', border: '1px solid rgba(148, 163, 184, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}>DRAFT</span>;
    }
  };

  const columns: ColumnDef<IPOApplicationRecord>[] = [
    {
      id: 'ipoInfo',
      header: 'IPO & Issuer',
      minWidth: 220,
      width: 250,
      accessor: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.issuerName || 'IPO Master Record'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
            <span>{row.ipoName || row.ipoId}</span>
            {row.symbol && <span style={{ background: 'var(--color-surface-hover)', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>{row.symbol}</span>}
          </div>
        </div>
      )
    },
    {
      id: 'applicationDate',
      header: 'Applied Date',
      minWidth: 120,
      width: 130,
      accessor: (row) => (
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
          {formatDate(row.applicationDate)}
        </span>
      )
    },
    {
      id: 'account',
      header: 'Account / Broker',
      minWidth: 160,
      width: 180,
      accessor: (row) => (
        <div style={{ fontSize: '0.8125rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.accountDisplayName || 'Dematerialized Account'}</div>
          {row.paymentReference && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>Ref: {row.paymentReference}</div>}
        </div>
      )
    },
    {
      id: 'lots',
      header: 'Lots / Qty',
      minWidth: 110,
      width: 120,
      numeric: true,
      accessor: (row) => (
        <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.lotsApplied} {row.lotsApplied === 1 ? 'Lot' : 'Lots'}</span>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{row.quantityApplied} Shares</div>
        </div>
      )
    },
    {
      id: 'amount',
      header: 'Application Amount',
      minWidth: 150,
      width: 160,
      numeric: true,
      accessor: (row) => (
        <div>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-brand-primary)' }}>
            {formatCurrency(row.applicationAmount)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Recorded Value</div>
        </div>
      )
    },
    {
      id: 'status',
      header: 'Status',
      minWidth: 140,
      width: 150,
      accessor: (row) => getStatusBadge(row.status)
    },
    {
      id: 'actions',
      header: 'Action',
      minWidth: 100,
      width: 110,
      accessor: (row) => (
        <button
          onClick={() => setSelectedApp(row)}
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
          View / Edit
        </button>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="IPO Application Tracker"
        description="Track personal IPO applications, broker accounts, payment status, and order details"
        phaseBadge="PHASE 7 ACTIVE"
      />

      {/* Navigation Tab Bar between IPO Center and Applications */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--color-border)',
        marginBottom: '20px'
      }}>
        <Link
          to="/ipo"
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
            borderBottom: '2px solid transparent'
          }}
        >
          IPO Master Center
        </Link>
        <Link
          to="/ipo/applications"
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--color-brand-primary)',
            textDecoration: 'none',
            borderBottom: '2px solid var(--color-brand-primary)'
          }}
        >
          My IPO Applications
        </Link>
      </div>

      {/* Summary Deck Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>{summary.total}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Submitted</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#3B82F6', marginTop: '2px' }}>{summary.submitted}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Payment Pending</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#F59E0B', marginTop: '2px' }}>{summary.paymentPending}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Payment Confirmed</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#10B981', marginTop: '2px' }}>{summary.paymentConfirmed}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#A855F7', marginTop: '2px' }}>{summary.completed}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Cancelled</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#EF4444', marginTop: '2px' }}>{summary.cancelled}</div>
        </div>
      </div>

      {/* Toolbar: Search, Filters & Create Button */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '6px 12px', flex: '1 1 220px' }}>
            <Search size={16} color="var(--color-text-muted)" />
            <input
              type="text"
              placeholder="Search by issuer, symbol, account, or ref..."
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
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PAYMENT_PENDING">Payment Pending</option>
              <option value="PAYMENT_CONFIRMED">Payment Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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
          <Plus size={16} />
          <span>Track New Application</span>
        </button>
      </div>

      {/* Applications Data Table */}
      {loading ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px display' }} />
          <div>Loading IPO applications...</div>
        </div>
      ) : error ? (
        <EmptyState
          title="Applications Temporarily Unavailable"
          description={error}
          icon={<FileText size={36} color="var(--color-danger)" />}
        />
      ) : applications.length === 0 ? (
        search || statusFilter ? (
          <EmptyState
            title="No Matching Applications Found"
            description="No IPO application records match your search filters."
            icon={<Search size={36} color="var(--color-text-muted)" />}
          />
        ) : (
          <EmptyState
            title="No IPO Applications Recorded Yet"
            description="Record your personal IPO application details (broker, lots, application amount, payment reference) to begin tracking."
            icon={<FileText size={36} color="var(--color-brand-primary)" />}
            action={
              <button
                onClick={() => {
                  resetForm();
                  setIsCreateModalOpen(true);
                }}
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
                Track New Application
              </button>
            }
          />
        )
      ) : (
        <ResizableTable
          columns={columns}
          data={applications}
          keyExtractor={(item) => item.id}
          emptyTitle="No Applications"
          emptyDescription="No applications recorded."
        />
      )}

      {/* Create Application Modal */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
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
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            position: 'relative'
          }}>
            <button
              onClick={() => setIsCreateModalOpen(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>Track IPO Application</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Record personal IPO application terms linked to canonical master records and broker account.
            </p>

            {formError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8125rem', marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Select Canonical IPO *</label>
                <select
                  value={selectedIpoId}
                  onChange={(e) => setSelectedIpoId(e.target.value)}
                  required
                  style={{ width: '100%', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.875rem', outline: 'none' }}
                >
                  <option value="">-- Choose Canonical IPO --</option>
                  {availableIpos.map(ipo => (
                    <option key={ipo.id} value={ipo.id}>
                      {ipo.issuerName} ({ipo.symbol || 'SME/Equities'}) • {ipo.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Application Account / Broker *</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                  style={{ width: '100%', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.875rem', outline: 'none' }}
                >
                  <option value="">-- Choose Account / Broker --</option>
                  {availableAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.displayName} ({acc.accountType})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Application Date *</label>
                  <input
                    type="date"
                    value={applicationDate}
                    onChange={(e) => setApplicationDate(e.target.value)}
                    required
                    style={{ width: '100%', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.875rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Lots Applied *</label>
                  <input
                    type="number"
                    min="1"
                    value={lotsApplied}
                    onChange={(e) => setLotsApplied(parseInt(e.target.value, 10) || 1)}
                    required
                    style={{ width: '100%', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.875rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ background: 'var(--color-surface-hover)', padding: '12px', borderRadius: '6px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Calculated Share Quantity:</span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{quantityApplied} Shares</strong>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Recorded Application Amount (₹) *</label>
                <input
                  type="text"
                  placeholder="e.g. 14250.0000"
                  value={applicationAmount}
                  onChange={(e) => setApplicationAmount(e.target.value)}
                  required
                  style={{ width: '100%', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.875rem', outline: 'none', fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
                  Defaults to estimated priceBandHigh × quantityApplied. User recorded amount is saved.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Payment Reference / UPI Mandate Ref (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-MANDATE-998822"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  style={{ width: '100%', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.875rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Notes / Order ID (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Applied via ASBA Internet Banking..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.875rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '8px 16px', borderRadius: '6px', fontSize: '0.8125rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: 'var(--color-brand-primary)', color: '#FFF', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Recording...' : 'Record Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Detail & Lifecycle Drawer */}
      {selectedApp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
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
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            position: 'relative'
          }}>
            <button
              onClick={() => setSelectedApp(null)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{selectedApp.issuerName || 'IPO Application'}</h2>
              {getStatusBadge(selectedApp.status)}
            </div>

            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Application ID: <span style={{ fontFamily: 'monospace' }}>{selectedApp.id}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Account / Broker</div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{selectedApp.accountDisplayName || 'Default Demat'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Application Date</div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{formatDate(selectedApp.applicationDate)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Lots Applied</div>
                <div style={{ fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>{selectedApp.lotsApplied} Lots ({selectedApp.quantityApplied} Shares)</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Recorded Application Amount</div>
                <div style={{ fontWeight: 700, marginTop: '2px', color: 'var(--color-brand-primary)', fontFamily: 'monospace' }}>
                  {formatCurrency(selectedApp.applicationAmount)}
                </div>
              </div>
              {selectedApp.paymentReference && (
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Payment / Mandate Reference</div>
                  <div style={{ fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>{selectedApp.paymentReference}</div>
                </div>
              )}
            </div>

            {/* Lifecycle Transition Actions */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '10px' }}>Lifecycle State Transitions</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedApp.status === 'SUBMITTED' && (
                  <>
                    <button
                      onClick={() => handleStatusTransition(selectedApp.id, 'PAYMENT_PENDING')}
                      style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Mark Payment Pending
                    </button>
                    <button
                      onClick={() => handleStatusTransition(selectedApp.id, 'PAYMENT_CONFIRMED')}
                      style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Confirm Payment
                    </button>
                  </>
                )}
                {(selectedApp.status === 'SUBMITTED' || selectedApp.status === 'PAYMENT_PENDING' || selectedApp.status === 'PAYMENT_CONFIRMED') && (
                  <button
                    onClick={() => handleStatusTransition(selectedApp.id, 'COMPLETED')}
                    style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#A855F7', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Mark Workflow Completed
                  </button>
                )}
                {selectedApp.status !== 'CANCELLED' && selectedApp.status !== 'COMPLETED' && (
                  <button
                    onClick={() => handleStatusTransition(selectedApp.id, 'CANCELLED')}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel Application
                  </button>
                )}
              </div>
            </div>

            {/* Phase 8 Allotment Placeholder Banner */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)'
            }}>
              <ShieldCheck size={20} color="#3B82F6" />
              <div>
                <strong style={{ color: 'var(--color-text-primary)' }}>Allotment Verification Placeholder</strong>
                <div style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--color-text-muted)' }}>
                  Allotment checking and registrar verification will be available in Phase 8.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
