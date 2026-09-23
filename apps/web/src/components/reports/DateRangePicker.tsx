/**
 * FINANCE COMMAND CENTER (APEX OS)
 * DateRangePicker Component (Phase 16)
 */

import React from 'react';
import { DateRangePreset, DateRangeFilter } from '@finance-command-center/shared-types';
import { Calendar, Filter } from 'lucide-react';

interface DateRangePickerProps {
  filter: DateRangeFilter;
  onChange: (filter: DateRangeFilter) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ filter, onChange }) => {
  const presets: Array<{ id: DateRangePreset; label: string }> = [
    { id: 'ALL_TIME', label: 'All Time' },
    { id: 'TODAY', label: 'Today' },
    { id: 'YESTERDAY', label: 'Yesterday' },
    { id: 'CURRENT_WEEK', label: 'Current Week' },
    { id: 'PREVIOUS_WEEK', label: 'Previous Week' },
    { id: 'CURRENT_MONTH', label: 'Current Month' },
    { id: 'PREVIOUS_MONTH', label: 'Previous Month' },
    { id: 'CURRENT_QUARTER', label: 'Current Quarter' },
    { id: 'CURRENT_YEAR', label: 'Current Year' },
    { id: 'PREVIOUS_YEAR', label: 'Previous Year' },
    { id: 'CUSTOM', label: 'Custom Date Range' }
  ];

  const handlePresetChange = (preset: DateRangePreset) => {
    if (preset === 'CUSTOM') {
      onChange({ ...filter, preset: 'CUSTOM' });
    } else {
      onChange({ preset, timezone: 'Asia/Kolkata' });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: 'var(--color-surface-card, #1e293b)',
        border: '1px solid var(--color-border, #334155)',
        borderRadius: '8px',
        marginBottom: '20px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary, #94a3b8)', fontSize: '14px', fontWeight: 500 }}>
        <Calendar size={16} />
        <span>Date Range:</span>
      </div>

      <select
        value={filter.preset || 'ALL_TIME'}
        onChange={(e) => handlePresetChange(e.target.value as DateRangePreset)}
        style={{
          padding: '6px 12px',
          backgroundColor: 'var(--color-surface-bg, #0f172a)',
          color: 'var(--color-text-primary, #ffffff)',
          border: '1px solid var(--color-border, #334155)',
          borderRadius: '6px',
          fontSize: '14px'
        }}
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {filter.preset === 'CUSTOM' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="date"
            value={filter.fromDate || ''}
            onChange={(e) => onChange({ ...filter, preset: 'CUSTOM', fromDate: e.target.value })}
            style={{
              padding: '6px 10px',
              backgroundColor: 'var(--color-surface-bg, #0f172a)',
              color: 'var(--color-text-primary, #ffffff)',
              border: '1px solid var(--color-border, #334155)',
              borderRadius: '6px',
              fontSize: '13px'
            }}
          />
          <span style={{ color: '#64748b' }}>to</span>
          <input
            type="date"
            value={filter.toDate || ''}
            onChange={(e) => onChange({ ...filter, preset: 'CUSTOM', toDate: e.target.value })}
            style={{
              padding: '6px 10px',
              backgroundColor: 'var(--color-surface-bg, #0f172a)',
              color: 'var(--color-text-primary, #ffffff)',
              border: '1px solid var(--color-border, #334155)',
              borderRadius: '6px',
              fontSize: '13px'
            }}
          />
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
        <Filter size={12} />
        Timezone: {filter.timezone || 'Asia/Kolkata (IST)'}
      </div>
    </div>
  );
};
