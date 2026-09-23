import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Inbox, RefreshCw, X } from 'lucide-react';
import { NotificationRecord } from '@finance-command-center/shared-types';
import { useAuth } from '../../context/AuthContext';

export const NotificationCenter: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/v1/notifications/unread-count', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUnreadCount(json.data.unreadCount || 0);
        }
      }
    } catch {
      // Ignore background network errors
    }
  };

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/notifications?limit=20', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) {
          setNotifications(json.data.items);
        }
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, status: 'READ' })));
      }
    } catch {
      // Ignore
    }
  };

  const handleMarkSingleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: 'READ' } : n))
        );
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          backgroundColor: isOpen ? 'var(--color-bg-elevated)' : 'transparent',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)'
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: 'var(--color-status-danger)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 5px',
              borderRadius: '10px',
              minWidth: '16px',
              textAlign: 'center',
              lineHeight: 1
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '46px',
            right: 0,
            width: '380px',
            maxHeight: '480px',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--color-bg-elevated)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--color-status-danger)',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-brand-primary)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2)' }}>
            {isLoading ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={20} className="spin" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: 'var(--font-size-xs)' }}>Loading notifications...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Inbox size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>No notifications yet</div>
                <div style={{ fontSize: 'var(--font-size-xs)' }}>Triggered alert notifications will appear here.</div>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = n.status === 'UNREAD';
                return (
                  <div
                    key={n.id}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isUnread ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                      borderLeft: isUnread ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'background-color var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                        {n.title}
                      </span>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkSingleRead(n.id, e)}
                          title="Mark as read"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          <CheckCheck size={14} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '4px',
                        fontSize: '10px',
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          color: n.notificationType === 'MARKET_ALERT'
                            ? 'var(--color-brand-primary)'
                            : n.notificationType === 'PORTFOLIO_ALERT'
                            ? 'var(--color-status-success)'
                            : 'var(--color-status-warning)'
                        }}
                      >
                        {n.notificationType.replace('_ALERT', '')}
                      </span>
                      <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
