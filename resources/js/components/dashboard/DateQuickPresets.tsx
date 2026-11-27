import React from 'react';

interface DateQuickPresetsProps {
  value: string;
  onChange: (date: string) => void;
  tone?: 'indigo' | 'teal' | 'rose' | 'amber' | 'slate' | 'dark';
  allowAll?: boolean;
  className?: string;
}

export const getIstDatePresets = () => {
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const dayBeforeYesterday = new Date(now.getTime() - 86400000 * 2).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  return { today, yesterday, dayBeforeYesterday };
};

export const DateQuickPresets: React.FC<DateQuickPresetsProps> = ({
  value,
  onChange,
  tone = 'indigo',
  allowAll = false,
  className = '',
}) => {
  const { today, yesterday, dayBeforeYesterday } = getIstDatePresets();

  const activeStyles: Record<NonNullable<DateQuickPresetsProps['tone']>, string> = {
    indigo: 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-semibold',
    teal: 'bg-teal-600 text-white border-teal-600 shadow-xs font-semibold',
    rose: 'bg-rose-600 text-white border-rose-600 shadow-xs font-semibold',
    amber: 'bg-amber-600 text-white border-amber-600 shadow-xs font-semibold',
    slate: 'bg-slate-800 text-white border-slate-800 shadow-xs font-semibold',
    dark: 'bg-indigo-600 text-white border-indigo-500 shadow-xs font-bold',
  };

  const inactiveClass =
    tone === 'dark'
      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700 font-medium'
      : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-slate-200 font-medium';

  const presets = [
    { key: 'today', label: 'Today', date: today },
    { key: 'yesterday', label: 'Yesterday', date: yesterday },
    { key: 'day-before', label: 'Day Before Yesterday', date: dayBeforeYesterday },
  ];

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {presets.map((preset) => {
        const isActive = value === preset.date;
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => onChange(preset.date)}
            className={`px-2 py-1 rounded-md text-[11px] border transition cursor-pointer whitespace-nowrap ${
              isActive ? activeStyles[tone] : inactiveClass
            }`}
          >
            {preset.label}
          </button>
        );
      })}
      {allowAll && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={`px-2 py-1 rounded-md text-[11px] border transition cursor-pointer whitespace-nowrap ${
            value === '' ? activeStyles[tone] : inactiveClass
          }`}
        >
          All
        </button>
      )}
    </div>
  );
};
