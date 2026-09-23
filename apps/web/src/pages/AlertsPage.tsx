import React, { useState, useEffect } from 'react';
import { Bell, Plus, Play, Pause, Archive, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ResizableTable, ColumnDef } from '../components/common/ResizableTable';
import { AlertRuleRecord, AlertType, AlertTargetType } from '@finance-command-center/shared-types';
import { useAuth } from '../context/AuthContext';

export const AlertsPage: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [rules, setRules] = useState<AlertRuleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [alertType, setAlertType] = useState<AlertType>('PRICE_ABOVE');
  const [targetType, setTargetType] = useState<AlertTargetType>('MARKET_INSTRUMENT');
  const [targetId, setTargetId] = useState('');
  const [thresholdValue, setThresholdValue] = useState('');
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchRules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/alerts', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setRules(json.data || []);
      } else {
        setError('Failed to fetch alert rules');
      }
    } catch {
      setError('Network error fetching alert rules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleEvaluateAll = async () => {
    try {
      const res = await fetch('/api/v1/alerts/evaluate-all', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchRules();
      }
    } catch {
      // Ignore
    }
  };

  const handlePause = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/alerts/${id}/pause`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) fetchRules();
    } catch {
      // Ignore
    }
  };

  const handleResume = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/alerts/${id}/resume`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) fetchRules();
    } catch {
      // Ignore
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/alerts/${id}/archive`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) fetchRules();
    } catch {
      // Ignore
    }
  };

  const handleEvaluateSingle = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/alerts/${id}/evaluate`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) fetchRules();
    } catch {
      // Ignore
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !targetId.trim()) {
      setModalError('Rule Name and Target ID are required');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: ruleName.trim(),
          alertType,
          targetType,
          targetId: targetId.trim(),
          thresholdValue: thresholdValue.trim() || null,
          cooldownMinutes
        })
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        setRuleName('');
        setTargetId('');
        setThresholdValue('');
        fetchRules();
      } else {
        const json = await res.json();
        setModalError(json.error?.message || 'Failed to create alert rule');
      }
    } catch {
      setModalError('Network error creating alert rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRulesCount = rules.filter((r: AlertRuleRecord) => r.status === 'ACTIVE').length;
  const pausedRulesCount = rules.filter((r: AlertRuleRecord) => r.status === 'PAUSED').length;

  const columns: ColumnDef<AlertRuleRecord>[] = [
    {
      id: 'name',
      header: 'Rule Name',
      accessor: (r: AlertRuleRecord) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}</div>
          {r.description && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{r.description}</div>}
        </div>
      ),
      width: 200
    },
    {
      id: 'alertType',
      header: 'Alert Type',
      accessor: (r: AlertRuleRecord) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-bg-elevated)',
            color: 'var(--color-brand-primary)'
          }}
        >
          {r.alertType}
        </span>
      ),
      width: 180
    },
    {
      id: 'targetType',
      header: 'Target',
      accessor: (r: AlertRuleRecord) => (
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {r.targetType}:
          </span>{' '}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{r.targetId.slice(0, 8)}...</span>
        </div>
      ),
      width: 160
    },
    {
      id: 'thresholdValue',
      header: 'Threshold',
      accessor: (r: AlertRuleRecord) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {r.thresholdValue || r.thresholdPercent ? `₹${r.thresholdValue || r.thresholdPercent}` : 'N/A (State)'}
        </span>
      ),
      width: 130
    },
    {
      id: 'cooldownMinutes',
      header: 'Cooldown',
      accessor: (r: AlertRuleRecord) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{r.cooldownMinutes}m</span>,
      width: 100
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (r: AlertRuleRecord) => (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor:
              r.status === 'ACTIVE'
                ? 'rgba(34, 197, 94, 0.15)'
                : r.status === 'PAUSED'
                ? 'rgba(234, 179, 8, 0.15)'
                : 'rgba(100, 116, 139, 0.15)',
            color:
              r.status === 'ACTIVE'
                ? 'var(--color-status-success)'
                : r.status === 'PAUSED'
                ? 'var(--color-status-warning)'
                : 'var(--color-text-muted)'
          }}
        >
          {r.status}
        </span>
      ),
      width: 100
    },
    {
      id: 'lastTriggeredAt',
      header: 'Last Triggered',
      accessor: (r: AlertRuleRecord) => (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {r.lastTriggeredAt ? new Date(r.lastTriggeredAt).toLocaleString() : 'Never'}
        </span>
      ),
      width: 160
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: (r: AlertRuleRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {r.status === 'ACTIVE' ? (
            <button
              type="button"
              onClick={() => handlePause(r.id)}
              title="Pause Rule"
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                padding: '4px 8px',
                color: 'var(--color-status-warning)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px'
              }}
            >
              <Pause size={12} /> Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleResume(r.id)}
              title="Resume Rule"
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                padding: '4px 8px',
                color: 'var(--color-status-success)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px'
              }}
            >
              <Play size={12} /> Resume
            </button>
          )}

          <button
            type="button"
            onClick={() => handleEvaluateSingle(r.id)}
            title="Evaluate against live data"
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              padding: '4px 8px',
              color: 'var(--color-brand-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px'
            }}
          >
            <RefreshCw size={12} /> Eval
          </button>

          <button
            type="button"
            onClick={() => handleArchive(r.id)}
            title="Archive Rule"
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              padding: '4px 8px',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px'
            }}
          >
            <Archive size={12} />
          </button>
        </div>
      ),
      width: 200
    }
  ];

  return (
    <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Workspace Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: 0 }}>
            Alerts & Notifications Center
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: 'var(--font-size-sm)' }}>
            Configure condition rules for market instruments, portfolios, and IPOs with server-side threshold-crossing protection.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={handleEvaluateAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontWeight: 500,
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} /> Evaluate All Rules
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--color-brand-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} /> New Alert Rule
          </button>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>TOTAL RULES</div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginTop: '4px' }}>{rules.length}</div>
        </div>
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>ACTIVE RULES</div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginTop: '4px', color: 'var(--color-status-success)' }}>{activeRulesCount}</div>
        </div>
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>PAUSED RULES</div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginTop: '4px', color: 'var(--color-status-warning)' }}>{pausedRulesCount}</div>
        </div>
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>ZERO FAKE DATA</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-status-success)', fontWeight: 600, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={14} /> APEX Canonical Engine
          </div>
        </div>
      </div>

      {/* Main Table View */}
      {isLoading ? (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
          <div>Loading alert rules...</div>
        </div>
      ) : error ? (
        <div style={{ padding: 'var(--space-6)', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-status-danger)', borderRadius: 'var(--radius-md)', color: 'var(--color-status-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> {error}
        </div>
      ) : rules.length === 0 ? (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <Bell size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', opacity: 0.5 }} />
          <h3 style={{ margin: 0, fontWeight: 600 }}>No alert rules configured</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '4px', marginBottom: 'var(--space-4)' }}>
            Create custom price, portfolio P&L, or IPO alert rules to monitor market state transitions.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--color-brand-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Create First Alert Rule
          </button>
        </div>
      ) : (
        <ResizableTable columns={columns} data={rules} keyExtractor={(r) => r.id} />
      )}

      {/* Create Alert Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            style={{
              width: '480px',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)'
            }}
          >
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>Configure New Alert Rule</h2>

            {modalError && (
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-status-danger)', borderRadius: 'var(--radius-md)', color: 'var(--color-status-danger)', fontSize: 'var(--font-size-xs)' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>Rule Name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. RELIANCE Price Above ₹2500"
                  style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>Target Type</label>
                  <select
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value as AlertTargetType)}
                    style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-primary)' }}
                  >
                    <option value="MARKET_INSTRUMENT">Market Instrument</option>
                    <option value="PORTFOLIO">Portfolio</option>
                    <option value="IPO">IPO</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>Alert Type</label>
                  <select
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value as AlertType)}
                    style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-primary)' }}
                  >
                    {targetType === 'MARKET_INSTRUMENT' && (
                      <>
                        <option value="PRICE_ABOVE">PRICE_ABOVE</option>
                        <option value="PRICE_BELOW">PRICE_BELOW</option>
                        <option value="PRICE_CHANGE_PERCENT_ABOVE">PRICE_CHANGE_PERCENT_ABOVE</option>
                        <option value="PRICE_CHANGE_PERCENT_BELOW">PRICE_CHANGE_PERCENT_BELOW</option>
                        <option value="VOLUME_ABOVE">VOLUME_ABOVE</option>
                      </>
                    )}
                    {targetType === 'PORTFOLIO' && (
                      <>
                        <option value="PORTFOLIO_TOTAL_PNL_ABOVE">PORTFOLIO_TOTAL_PNL_ABOVE</option>
                        <option value="PORTFOLIO_TOTAL_PNL_BELOW">PORTFOLIO_TOTAL_PNL_BELOW</option>
                        <option value="PORTFOLIO_UNREALIZED_PNL_PERCENT_ABOVE">PORTFOLIO_UNREALIZED_PNL_PERCENT_ABOVE</option>
                        <option value="PORTFOLIO_UNREALIZED_PNL_PERCENT_BELOW">PORTFOLIO_UNREALIZED_PNL_PERCENT_BELOW</option>
                      </>
                    )}
                    {targetType === 'IPO' && (
                      <>
                        <option value="IPO_OPENING">IPO_OPENING</option>
                        <option value="IPO_CLOSING_SOON">IPO_CLOSING_SOON</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>Target Entity ID (UUID)</label>
                <input
                  type="text"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="e.g. 00000000-0000-4000-a000-000000000010"
                  style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}
                />
              </div>

              {alertType !== 'IPO_OPENING' && alertType !== 'IPO_CLOSING_SOON' && (
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>Threshold Value / Percentage</label>
                  <input
                    type="text"
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(e.target.value)}
                    placeholder="e.g. 2500.00"
                    style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>Cooldown Window (Minutes)</label>
                <input
                  type="number"
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(parseInt(e.target.value, 10) || 60)}
                  style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--color-brand-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Creating...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
