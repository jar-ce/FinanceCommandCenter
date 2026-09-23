import React, { useState, useEffect } from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { ResizableTable, ColumnDef } from '../components/common/ResizableTable';
import { RefreshCw, Search, AlertTriangle, X } from 'lucide-react';
import { IPOAllotmentResultRecord, IPOAllotmentSummary } from '@finance-command-center/shared-types';
import { useAuth } from '../context/AuthContext';

interface ApplicationOption {
  id: string;
  ipoName?: string;
  quantityApplied: number;
  status: string;
}

export const IpoAllotmentPage: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [allotments, setAllotments] = useState<IPOAllotmentResultRecord[]>([]);
  const [summary, setSummary] = useState<IPOAllotmentSummary>({
    total: 0,
    verified: 0,
    unverified: 0,
    stale: 0,
    manualRequired: 0,
    unavailable: 0,
    allottedCount: 0,
    partiallyAllottedCount: 0,
    notAllottedCount: 0
  });
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [verificationFilter, setVerificationFilter] = useState<string>('');

  // Selected for Detail Drawer
  const [selectedAllotment, setSelectedAllotment] = useState<IPOAllotmentResultRecord | null>(null);

  // Manual Verify Modal State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [targetAppId, setTargetAppId] = useState<string>('');
  const [targetAppliedQty, setTargetAppliedQty] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<'ALLOTTED' | 'PARTIALLY_ALLOTTED' | 'NOT_ALLOTTED' | 'REJECTED'>('ALLOTTED');
  const [formAllottedQty, setFormAllottedQty] = useState<number>(0);
  const [formSource, setFormSource] = useState<string>('Official Registrar Portal (Manual Confirmation)');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, [search, statusFilter, verificationFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (verificationFilter) params.append('verificationStatus', verificationFilter);

      const [allotmentRes, appRes] = await Promise.all([
        fetch(`/api/v1/ipo/allotments?${params.toString()}`, {
          headers: { ...getAuthHeaders() }
        }),
        fetch('/api/v1/ipo/applications', {
          headers: { ...getAuthHeaders() }
        })
      ]);

      if (allotmentRes.ok) {
        const json = await allotmentRes.json();
        setAllotments(json.data || []);
        if (json.summary) setSummary(json.summary);
      }
      if (appRes.ok) {
        const json = await appRes.json();
        setApplications(json.data || []);
      }
    } catch {
      // Graceful fallback when API backend is unmounted
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAllotment = async (appId: string) => {
    try {
      const res = await fetch(`/api/v1/ipo/allotments/check/${appId}`, {
        method: 'POST',
        headers: { ...getAuthHeaders() }
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // Handle check error
    }
  };

  const openVerifyModal = (appId: string, appliedQty: number) => {
    setTargetAppId(appId);
    setTargetAppliedQty(appliedQty);
    setFormStatus('ALLOTTED');
    setFormAllottedQty(appliedQty);
    setFormSource('Official Registrar Portal (Manual Confirmation)');
    setFormNotes('');
    setFormError(null);
    setIsVerifyModalOpen(true);
  };

  const handleManualVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formAllottedQty < 0) {
      setFormError('Allotted quantity cannot be negative.');
      return;
    }
    if (formAllottedQty > targetAppliedQty) {
      setFormError(`Allotted quantity (${formAllottedQty}) cannot exceed applied quantity (${targetAppliedQty}).`);
      return;
    }
    if (formStatus === 'PARTIALLY_ALLOTTED' && (formAllottedQty <= 0 || formAllottedQty >= targetAppliedQty)) {
      setFormError('PARTIALLY_ALLOTTED requires allotted quantity strictly between 0 and applied quantity.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/ipo/allotments/verify/${targetAppId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          allotmentStatus: formStatus,
          allottedQuantity: formAllottedQty,
          source: formSource,
          notes: formNotes
        })
      });

      if (!res.ok) {
        const json = await res.json();
        setFormError(json.error?.message || 'Failed to submit manual verification.');
        return;
      }

      setIsVerifyModalOpen(false);
      await fetchData();
    } catch {
      setFormError('Network error while saving verification.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<IPOAllotmentResultRecord>[] = [
    {
      id: 'ipoName',
      header: 'IPO Issue',
      width: 220,
      minWidth: 160,
      accessor: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-100">{row.ipoName || 'IPO Issue'}</span>
          <span className="text-xs text-slate-400">{row.issuerName || row.symbol || 'Mainboard'}</span>
        </div>
      )
    },
    {
      id: 'maskedApplicationNumber',
      header: 'Application Ref',
      width: 150,
      minWidth: 120,
      accessor: (row) => (
        <span className="font-mono text-xs text-cyan-300">
          {row.maskedApplicationNumber || 'APP-***'}
        </span>
      )
    },
    {
      id: 'appliedQuantity',
      header: 'Applied Qty',
      width: 110,
      minWidth: 90,
      numeric: true,
      accessor: (row) => (
        <span className="font-mono text-slate-200">{row.appliedQuantity}</span>
      )
    },
    {
      id: 'allottedQuantity',
      header: 'Allotted Qty',
      width: 110,
      minWidth: 90,
      numeric: true,
      accessor: (row) => (
        <span className={`font-mono font-bold ${row.allottedQuantity > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
          {row.allottedQuantity}
        </span>
      )
    },
    {
      id: 'allotmentStatus',
      header: 'Allotment Result',
      width: 160,
      minWidth: 130,
      accessor: (row) => {
        const statusMap: Record<string, { label: string; bg: string; text: string }> = {
          ALLOTTED: { label: 'ALLOTTED', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
          PARTIALLY_ALLOTTED: { label: 'PARTIAL', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
          NOT_ALLOTTED: { label: 'NOT ALLOTTED', bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400' },
          REJECTED: { label: 'REJECTED', bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400' },
          PENDING: { label: 'PENDING', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
          UNKNOWN: { label: 'UNKNOWN', bg: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-400' }
        };
        const conf = statusMap[row.allotmentStatus] || statusMap.UNKNOWN;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${conf.bg} ${conf.text}`}>
            {conf.label}
          </span>
        );
      }
    },
    {
      id: 'verificationStatus',
      header: 'Verification',
      width: 160,
      minWidth: 130,
      accessor: (row) => {
        const verMap: Record<string, { label: string; bg: string; text: string }> = {
          VERIFIED: { label: row.verificationMethod === 'MANUAL' ? 'VERIFIED (MANUAL)' : 'VERIFIED (API)', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
          UNVERIFIED: { label: 'UNVERIFIED', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
          STALE: { label: 'STALE', bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400' },
          MANUAL_REQUIRED: { label: 'MANUAL REQUIRED', bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400' },
          UNAVAILABLE: { label: 'UNAVAILABLE', bg: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-400' }
        };
        const conf = verMap[row.verificationStatus] || verMap.UNAVAILABLE;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${conf.bg} ${conf.text}`}>
            {conf.label}
          </span>
        );
      }
    },
    {
      id: 'provider',
      header: 'Provider',
      width: 150,
      minWidth: 120,
      accessor: (row) => (
        <span className="text-xs text-slate-300 truncate max-w-[140px]" title={row.source}>
          {row.provider}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 180,
      minWidth: 140,
      accessor: (row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleCheckAllotment(row.applicationId)}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded border border-cyan-500/30 transition-colors"
            title="Check Provider"
          >
            Check
          </button>
          <button
            onClick={() => openVerifyModal(row.applicationId, row.appliedQuantity)}
            className="px-2 py-1 text-xs bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-200 rounded border border-cyan-500/40 transition-colors"
            title="Manual Verify"
          >
            Verify
          </button>
          <button
            onClick={() => setSelectedAllotment(row)}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
          >
            Details
          </button>
        </div>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="IPO ALLOTMENT CHECKER"
        description="Verify and track official & user-verified IPO allotment results linked to your applications."
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchData}
              className="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh Deck
            </button>
          </div>
        }
      />

      {/* Summary Deck */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-slate-900/60 border border-cyan-500/20 rounded-lg p-3">
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider block">Awaiting Verification</span>
          <span className="text-xl font-bold font-mono text-slate-100 mt-1 block">
            {summary.manualRequired + summary.unavailable + summary.unverified}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Requires action/check</span>
        </div>

        <div className="bg-slate-900/60 border border-emerald-500/20 rounded-lg p-3">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Verified Allotted</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">{summary.allottedCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Full allotment</span>
        </div>

        <div className="bg-slate-900/60 border border-amber-500/20 rounded-lg p-3">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">Partially Allotted</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">{summary.partiallyAllottedCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Partial allotment</span>
        </div>

        <div className="bg-slate-900/60 border border-rose-500/20 rounded-lg p-3">
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">Not Allotted</span>
          <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">{summary.notAllottedCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Zero allotment</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Tracked</span>
          <span className="text-xl font-bold font-mono text-slate-200 mt-1 block">{summary.total}</span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">All records</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by IPO, Symbol, or App Ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Allotment Statuses</option>
          <option value="ALLOTTED">Allotted</option>
          <option value="PARTIALLY_ALLOTTED">Partially Allotted</option>
          <option value="NOT_ALLOTTED">Not Allotted</option>
          <option value="REJECTED">Rejected</option>
          <option value="UNKNOWN">Unknown</option>
        </select>

        <select
          value={verificationFilter}
          onChange={(e) => setVerificationFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Verification States</option>
          <option value="VERIFIED">Verified</option>
          <option value="MANUAL_REQUIRED">Manual Required</option>
          <option value="UNAVAILABLE">Unavailable</option>
          <option value="UNVERIFIED">Unverified</option>
          <option value="STALE">Stale</option>
        </select>
      </div>

      {/* Applications list requiring check section if allotments empty */}
      {applications.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Phase 7 Applications Available for Allotment Check</h3>
            <span className="text-xs text-slate-500">{applications.length} Applications</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {applications.slice(0, 6).map((app) => (
              <div key={app.id} className="bg-slate-950 border border-slate-800 rounded p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">{app.ipoName || 'IPO Application'}</span>
                  <span className="text-[10px] text-slate-400 font-mono">Qty: {app.quantityApplied} shares</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCheckAllotment(app.id)}
                    className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded border border-cyan-500/30 transition-colors"
                  >
                    Check
                  </button>
                  <button
                    onClick={() => openVerifyModal(app.id, app.quantityApplied)}
                    className="px-2 py-1 text-[11px] bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-200 rounded border border-cyan-500/40 transition-colors"
                  >
                    Verify
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Resizable Table */}
      {allotments.length === 0 && !loading ? (
        <EmptyState
          title="No Allotment Records Found"
          description="Select an existing Phase 7 application above to run an allotment check or record a manual verification."
        />
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
          <ResizableTable
            columns={columns}
            data={allotments}
            keyExtractor={(row) => row.id}
          />
        </div>
      )}

      {/* Manual Verification Modal */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setIsVerifyModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-100 mb-1">Manual Allotment Verification</h3>
            <p className="text-xs text-slate-400 mb-4">
              Record a verified allotment outcome confirmed via official registrar or exchange portal.
            </p>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 mb-4 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300">
                Notice: Manually entered results are recorded as <strong className="font-semibold">VERIFIED (MANUAL)</strong> and are never represented as automated provider API data.
              </p>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded p-3 mb-4 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleManualVerifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Allotment Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => {
                    const s = e.target.value as any;
                    setFormStatus(s);
                    if (s === 'ALLOTTED') setFormAllottedQty(targetAppliedQty);
                    if (s === 'NOT_ALLOTTED' || s === 'REJECTED') setFormAllottedQty(0);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALLOTTED">ALLOTTED (Full Allotment)</option>
                  <option value="PARTIALLY_ALLOTTED">PARTIALLY ALLOTTED (Partial Shares)</option>
                  <option value="NOT_ALLOTTED">NOT ALLOTTED (Zero Shares)</option>
                  <option value="REJECTED">REJECTED (Application Rejected)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-slate-300">Allotted Quantity (Shares)</label>
                  <span className="text-[10px] text-slate-400">Applied: {targetAppliedQty} shares</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max={targetAppliedQty}
                  value={formAllottedQty}
                  onChange={(e) => setFormAllottedQty(parseInt(e.target.value, 10) || 0)}
                  disabled={formStatus === 'NOT_ALLOTTED' || formStatus === 'REJECTED'}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Verification Source / Provenance</label>
                <input
                  type="text"
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  placeholder="e.g. Link Intime Registrar Portal"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional verification details..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded shadow-lg shadow-cyan-900/30 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Confirming...' : 'Confirm Manual Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedAllotment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 max-w-lg w-full h-full p-6 overflow-y-auto relative shadow-2xl">
            <button
              onClick={() => setSelectedAllotment(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block mb-1">Allotment Record Details</span>
            <h2 className="text-lg font-bold text-slate-100 mb-1">{selectedAllotment.ipoName || 'IPO Allotment'}</h2>
            <p className="text-xs text-slate-400 mb-6">{selectedAllotment.issuerName || selectedAllotment.symbol || 'Mainboard Issue'}</p>

            {/* Section 1: Allotment Status */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-4">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Allotment Outcome</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] text-slate-500 block">Status</span>
                  <span className="text-sm font-bold text-emerald-400 mt-0.5 block">{selectedAllotment.allotmentStatus}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Allotment Ratio</span>
                  <span className="text-sm font-mono text-slate-200 mt-0.5 block">{selectedAllotment.allotmentRatio || '0.0000'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Applied Quantity</span>
                  <span className="text-sm font-mono text-slate-300 mt-0.5 block">{selectedAllotment.appliedQuantity} shares</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Allotted Quantity</span>
                  <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block">{selectedAllotment.allottedQuantity} shares</span>
                </div>
              </div>
            </div>

            {/* Section 2: Verification Provenance */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-4">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Verification Provenance</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Verification Status:</span>
                  <span className="font-semibold text-cyan-300">{selectedAllotment.verificationStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verification Method:</span>
                  <span className="font-mono text-slate-300">{selectedAllotment.verificationMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Provider:</span>
                  <span className="text-slate-300">{selectedAllotment.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Source:</span>
                  <span className="text-slate-300 truncate max-w-[200px]" title={selectedAllotment.source}>{selectedAllotment.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Verified:</span>
                  <span className="font-mono text-slate-400">
                    {selectedAllotment.verifiedAt ? new Date(selectedAllotment.verifiedAt).toLocaleString() : 'Not verified'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Phase 7 Application Link */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-4">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Linked Application (Phase 7)</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Application ID:</span>
                  <span className="font-mono text-cyan-400 truncate max-w-[180px]">{selectedAllotment.applicationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account:</span>
                  <span className="text-slate-300">{selectedAllotment.accountDisplayName || 'Personal Demat'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Application Ref:</span>
                  <span className="font-mono text-slate-300">{selectedAllotment.maskedApplicationNumber || 'APP-***'}</span>
                </div>
              </div>
            </div>

            {selectedAllotment.notes && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Notes & Disclosures</h4>
                <p className="text-xs text-slate-400 whitespace-pre-wrap">{selectedAllotment.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
};
