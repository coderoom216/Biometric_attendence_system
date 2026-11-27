import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Building2,
  Clock,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { DateQuickPresets } from './DateQuickPresets';

export interface HostelMetricData {
  hostelId: string;
  hostelName: string;
  code: string;
  warden: string;
  capacity: number;
  enrolled: number;
  present: number;
  late: number;
  leave: number;
  defaulters: number;
  complianceRate: number;
}

export interface DayBarData {
  date: string;
  label: string;
  hostels: HostelMetricData[];
  consolidated: {
    enrolled: number;
    present: number;
    late: number;
    leave: number;
    defaulters: number;
    complianceRate: number;
  };
}

interface HostelAttendanceBarChartProps {
  currentDate?: string;
  hostelId?: string; // 'all' | '1' | '2' | '3' | 'h-shivalik' | 'h-mandakini' | 'h-nilgiri'
  allowHostelSwitch?: boolean;
  onDateChange?: (date: string) => void;
  summaryData?: any;
}

/**
 * Normalizes any variation of hostel ID (e.g. '1', 'bh1', 'h-shivalik', 'Boys Hostel 1')
 * into the standard canonical slug used by the chart.
 */
export const normalizeHostelId = (id?: string | number | null): string => {
  if (!id) return 'all';
  const str = String(id).toLowerCase().trim();
  if (str === 'all' || str === '' || str === '0') return 'all';
  if (
    str === '1' ||
    str === 'h-shivalik' ||
    str === 'bh1' ||
    str === 'bh-1' ||
    str.includes('shivalik') ||
    str.includes('bh1') ||
    str.includes('bh-1') ||
    str.includes('boys hostel 1')
  ) {
    return 'h-shivalik';
  }
  if (
    str === '2' ||
    str === 'h-mandakini' ||
    str === 'gh' ||
    str === 'gh-1' ||
    str.includes('mandakini') ||
    str.includes('gh') ||
    str.includes('girls')
  ) {
    return 'h-mandakini';
  }
  if (
    str === '3' ||
    str === 'h-nilgiri' ||
    str === 'bh2' ||
    str === 'bh-2' ||
    str.includes('nilgiri') ||
    str.includes('bh2') ||
    str.includes('bh-2') ||
    str.includes('boys hostel 2')
  ) {
    return 'h-nilgiri';
  }
  return str;
};

/**
 * Generates dynamic 7-day multi-day history ending on the target date.
 */
export const generateMultiDayHistory = (baseDateStr: string): DayBarData[] => {
  const parts = baseDateStr.split('-');
  const baseDate = parts.length === 3 
    ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    : new Date();
  
  const isValidDate = !isNaN(baseDate.getTime());
  const endDate = isValidDate ? baseDate : new Date();

  const history: DayBarData[] = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Base variance patterns across 7 days
  const variancePatterns = [
    { p1: 87, l1: 6, lv1: 4, d1: 3, p2: 89, l2: 5, lv2: 4, d2: 2, p3: 85, l3: 7, lv3: 5, d3: 3 },
    { p1: 73, l1: 16, lv1: 4, d1: 7, p2: 78, l2: 13, lv2: 5, d2: 4, p3: 74, l3: 15, lv3: 5, d3: 6 },
    { p1: 84, l1: 8, lv1: 5, d1: 3, p2: 85, l2: 8, lv2: 5, d2: 2, p3: 81, l3: 10, lv3: 6, d3: 3 },
    { p1: 68, l1: 15, lv1: 11, d1: 6, p2: 72, l2: 12, lv2: 12, d2: 4, p3: 70, l3: 14, lv3: 10, d3: 6 },
    { p1: 83, l1: 9, lv1: 4, d1: 4, p2: 86, l2: 7, lv2: 4, d2: 3, p3: 82, l3: 9, lv3: 5, d3: 4 },
    { p1: 80, l1: 10, lv1: 5, d1: 5, p2: 80, l2: 10, lv2: 5, d2: 5, p3: 80, l3: 10, lv3: 5, d3: 5 },
    { p1: 85, l1: 8, lv1: 3, d1: 4, p2: 88, l2: 6, lv2: 4, d2: 2, p3: 83, l3: 9, lv3: 4, d3: 4 }
  ];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const label = `${daysOfWeek[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
    const v = variancePatterns[6 - i];

    const h1: HostelMetricData = {
      hostelId: 'h-shivalik',
      hostelName: 'Boys Hostel 1',
      code: 'BH1',
      warden: 'Mr. Sachin Sati',
      capacity: 180,
      enrolled: 150,
      present: v.p1,
      late: v.l1,
      leave: v.lv1,
      defaulters: v.d1,
      complianceRate: Math.round(((v.p1 + v.l1) / (v.p1 + v.l1 + v.d1)) * 100)
    };

    const h2: HostelMetricData = {
      hostelId: 'h-mandakini',
      hostelName: 'Girls Hostel',
      code: 'GH',
      warden: 'Dr. Kavita Tariyal',
      capacity: 165,
      enrolled: 150,
      present: v.p2,
      late: v.l2,
      leave: v.lv2,
      defaulters: v.d2,
      complianceRate: Math.round(((v.p2 + v.l2) / (v.p2 + v.l2 + v.d2)) * 100)
    };

    const h3: HostelMetricData = {
      hostelId: 'h-nilgiri',
      hostelName: 'Boys Hostel 2',
      code: 'BH2',
      warden: 'Dr. Pathak Sir',
      capacity: 180,
      enrolled: 150,
      present: v.p3,
      late: v.l3,
      leave: v.lv3,
      defaulters: v.d3,
      complianceRate: Math.round(((v.p3 + v.l3) / (v.p3 + v.l3 + v.d3)) * 100)
    };

    const totalEnrolled = h1.enrolled + h2.enrolled + h3.enrolled;
    const totalPresent = h1.present + h2.present + h3.present;
    const totalLate = h1.late + h2.late + h3.late;
    const totalLeave = h1.leave + h2.leave + h3.leave;
    const totalDefaulters = h1.defaulters + h2.defaulters + h3.defaulters;
    const compRate = Number((((totalPresent + totalLate) / (totalPresent + totalLate + totalDefaulters)) * 100).toFixed(1));

    history.push({
      date: dateStr,
      label,
      hostels: [h1, h2, h3],
      consolidated: {
        enrolled: totalEnrolled,
        present: totalPresent,
        late: totalLate,
        leave: totalLeave,
        defaulters: totalDefaulters,
        complianceRate: compRate
      }
    });
  }

  return history;
};

/**
 * Computes safe bar height in pixels, avoiding NaN and container overflow.
 */
const computeBarHeight = (value: number, maxVal: number, maxPx: number = 130, minPx: number = 6): number => {
  const safeVal = Number.isFinite(value) && value > 0 ? value : 0;
  const safeMax = Number.isFinite(maxVal) && maxVal > 0 ? maxVal : 100;
  if (safeVal === 0) return 0;
  const computed = (safeVal / safeMax) * maxPx;
  return Math.max(minPx, Math.min(maxPx, Math.round(computed)));
};

export const HostelAttendanceBarChart: React.FC<HostelAttendanceBarChartProps> = ({
  currentDate,
  hostelId = 'all',
  allowHostelSwitch = true,
  onDateChange,
  summaryData
}) => {
  const defaultToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const effectiveInitialDate = currentDate || defaultToday;
  const [selectedHostel, setSelectedHostel] = useState<string>(() => normalizeHostelId(hostelId));
  const [selectedChartDate, setSelectedChartDate] = useState<string>(effectiveInitialDate);
  const [chartMode, setChartMode] = useState<'comparative' | 'daily_trend'>('comparative');
  const [activeMetricFilter, setActiveMetricFilter] = useState<'all' | 'present' | 'late' | 'leave' | 'defaulters'>('all');
  const [, setHoveredBar] = useState<string | null>(null);
  const [liveSummary, setLiveSummary] = useState<any>(summaryData ?? null);
  const [liveTrends, setLiveTrends] = useState<any[] | null>(null);

  useEffect(() => {
    if (currentDate) {
      setSelectedChartDate(currentDate);
    }
  }, [currentDate]);

  useEffect(() => {
    setSelectedHostel(normalizeHostelId(hostelId));
  }, [hostelId]);

  useEffect(() => {
    if (summaryData && (!summaryData.date || summaryData.date === selectedChartDate)) {
      setLiveSummary(summaryData);
    }
  }, [summaryData, selectedChartDate]);

  useEffect(() => {
    let isCancelled = false;

    const loadLiveChartData = async () => {
      try {
        const shouldFetchSummary = !summaryData || (summaryData.date && summaryData.date !== selectedChartDate);
        const [summaryRes, trendsRes] = await Promise.allSettled([
          shouldFetchSummary ? apiService.getReportSummary(selectedChartDate) : Promise.resolve(summaryData),
          apiService.getReportTrends(selectedChartDate)
        ]);

        if (isCancelled) return;

        if (summaryRes.status === 'fulfilled' && summaryRes.value?.success) {
          setLiveSummary(summaryRes.value);
        }
        if (trendsRes.status === 'fulfilled' && trendsRes.value?.success && Array.isArray(trendsRes.value.trends)) {
          setLiveTrends(trendsRes.value.trends);
        }
      } catch {
        // Keep last valid chart state on transient network failure
      }
    };

    loadLiveChartData();
    const interval = setInterval(loadLiveChartData, 5000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [selectedChartDate, summaryData]);

  const mapHostelReportToMetric = (h: any): HostelMetricData => {
    const slug = normalizeHostelId(h.hostelId || h.code || h.hostelName);
    const metaBySlug: Record<string, { name: string; code: string; warden: string; capacity: number }> = {
      'h-shivalik': { name: 'Boys Hostel 1', code: 'BH1', warden: 'Mr. Sachin Sati', capacity: 180 },
      'h-mandakini': { name: 'Girls Hostel', code: 'GH', warden: 'Dr. Kavita Tariyal', capacity: 165 },
      'h-nilgiri': { name: 'Boys Hostel 2', code: 'BH2', warden: 'Dr. Pathak Sir', capacity: 180 },
    };
    const meta = metaBySlug[slug] ?? {
      name: h.hostelName || 'Hostel',
      code: h.code || 'H',
      warden: 'Assigned Warden',
      capacity: 180,
    };
    const present = Number(h.present ?? h.presentCount ?? 0);
    const late = Number(h.late ?? h.lateCount ?? 0);
    const leave = Number(h.leave ?? h.leaveCount ?? 0);
    const defaulters = Number(h.defaulters ?? h.defaulterCount ?? 0);
    const enrolled = Number(h.totalEnrolled ?? h.totalResidents ?? h.enrolled ?? 0);
    const denom = present + late + defaulters;

    return {
      hostelId: slug,
      hostelName: h.hostelName || meta.name,
      code: h.code || meta.code,
      warden: meta.warden,
      capacity: meta.capacity,
      enrolled,
      present,
      late,
      leave,
      defaulters,
      complianceRate: Number(h.complianceRate ?? (denom > 0 ? Math.round(((present + late) / denom) * 100) : 0)),
    };
  };

  // Live 7-day trend built from /api/reports/trends (falls back to empty 0-baseline if unavailable)
  const multiDayHistory = useMemo(() => {
    if (liveTrends && liveTrends.length > 0) {
      return liveTrends.map((t: any): DayBarData => {
        const mappedHostels: HostelMetricData[] = Array.isArray(t.hostels)
          ? t.hostels.map(mapHostelReportToMetric)
          : [];
        const present = Number(t.present ?? 0);
        const late = Number(t.late ?? 0);
        const leave = Number(t.leave ?? 0);
        const defaulters = Number(t.defaulters ?? 0);
        const enrolled = Number(t.enrolled ?? 0);
        const denom = present + late + defaulters;

        return {
          date: t.isoDate || selectedChartDate,
          label: t.label || t.date || selectedChartDate,
          hostels: mappedHostels,
          consolidated: {
            enrolled,
            present,
            late,
            leave,
            defaulters,
            complianceRate: denom > 0 ? Number((((present + late) / denom) * 100).toFixed(1)) : 0,
          },
        };
      });
    }

    return generateMultiDayHistory(selectedChartDate).map((day) => ({
      ...day,
      hostels: day.hostels.map((h) => ({ ...h, enrolled: 0, present: 0, late: 0, leave: 0, defaulters: 0, complianceRate: 0 })),
      consolidated: { enrolled: 0, present: 0, late: 0, leave: 0, defaulters: 0, complianceRate: 0 },
    }));
  }, [liveTrends, selectedChartDate]);

  // Active day data: prefer live /api/reports/summary for selectedChartDate
  const currentDayData = useMemo((): DayBarData => {
    const matchingTrendDay = multiDayHistory.find((d) => d.date === selectedChartDate) || multiDayHistory[multiDayHistory.length - 1];
    if (liveSummary?.hostelReports && Array.isArray(liveSummary.hostelReports) && liveSummary.hostelReports.length > 0) {
      const hostels = liveSummary.hostelReports.map(mapHostelReportToMetric);
      const c = liveSummary.consolidated ?? {};
      const present = Number(c.presentCount ?? c.totalPresent ?? 0);
      const late = Number(c.lateCount ?? c.totalLate ?? 0);
      const leave = Number(c.leaveCount ?? c.totalLeave ?? 0);
      const defaulters = Number(c.defaultersCount ?? c.totalDefaulters ?? 0);
      const enrolled = Number(c.totalEnrolled ?? c.totalStudents ?? 0);
      const denom = present + late + defaulters;
      const parts = selectedChartDate.split('-');
      const d = parts.length === 3
        ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
        : new Date();
      const label = !isNaN(d.getTime())
        ? `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}, ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getDate()}`
        : selectedChartDate;

      return {
        date: liveSummary.date || selectedChartDate,
        label,
        hostels,
        consolidated: {
          enrolled,
          present,
          late,
          leave,
          defaulters,
          complianceRate: denom > 0 ? Number((((present + late) / denom) * 100).toFixed(1)) : 0,
        },
      };
    }

    return matchingTrendDay;
  }, [liveSummary, multiDayHistory, selectedChartDate]);

  // Effective hostels to display with guaranteed fallback so it never disappears
  const displayedHostels = useMemo((): HostelMetricData[] => {
    const normalized = normalizeHostelId(selectedHostel);
    if (normalized === 'all') {
      return currentDayData.hostels;
    }
    const filtered = currentDayData.hostels.filter((h: HostelMetricData) => normalizeHostelId(h.hostelId) === normalized);
    return filtered.length > 0 ? filtered : currentDayData.hostels;
  }, [currentDayData, selectedHostel]);

  // Dynamic max value for proportional bar scaling
  const maxBarValue = useMemo(() => {
    const vals = displayedHostels.flatMap((h: HostelMetricData) => [h.present, h.late, h.leave, h.defaulters]);
    return Math.max(10, ...vals);
  }, [displayedHostels]);

  const maxTrendValue = useMemo(() => {
    const normalized = normalizeHostelId(selectedHostel);
    const vals = multiDayHistory.flatMap((day) => {
      if (normalized === 'all') {
        return [day.consolidated.present, day.consolidated.late, day.consolidated.leave, day.consolidated.defaulters];
      }
      const h = day.hostels.find((item) => normalizeHostelId(item.hostelId) === normalized);
      return h ? [h.present, h.late, h.leave, h.defaulters] : [0];
    });
    return Math.max(10, ...vals);
  }, [multiDayHistory, selectedHostel]);

  // Metrics colors and metadata
  const metricConfigs = [
    { key: 'present', label: 'Present On-Time (< 7:30 PM)', color: 'bg-emerald-500' },
    { key: 'late', label: 'Late Punch (7:30 PM through 10:00 PM)', color: 'bg-amber-500' },
    { key: 'leave', label: 'Approved Leave (FR-11)', color: 'bg-sky-500' },
    { key: 'defaulters', label: 'Defaulters (after 10:00 PM / no punch)', color: 'bg-red-500' }
  ];

  const normalizedCurrentHostel = normalizeHostelId(selectedHostel);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header with Title and Mode Switcher */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col gap-4 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Hostel Attendance & Defaulter Comparative Bar Chart</h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Official Biometric Audits
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                7:30 PM on-time cutoff, late punches through 10:00 PM, and after-10:00 PM / no-punch defaulter evaluation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 sm:self-auto">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <label htmlFor="hostel-attendance-chart-date" className="font-medium whitespace-nowrap">
              Select Date:
            </label>
            <input
              id="hostel-attendance-chart-date"
              type="date"
              value={selectedChartDate}
              onChange={(event) => {
                if (!event.target.value) return;
                setSelectedChartDate(event.target.value);
                onDateChange?.(event.target.value);
              }}
              aria-label="Select chart date"
              className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
            />
            <DateQuickPresets
              value={selectedChartDate}
              onChange={(date) => {
                setSelectedChartDate(date);
                onDateChange?.(date);
              }}
              tone="indigo"
            />
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
          {allowHostelSwitch && (
            <div className="flex flex-wrap bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setSelectedHostel('all')}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
                  normalizedCurrentHostel === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                All Hostels (3)
              </button>
              <button
                type="button"
                onClick={() => setSelectedHostel('h-shivalik')}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
                  normalizedCurrentHostel === 'h-shivalik' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                BH1 (Sachin Sir)
              </button>
              <button
                type="button"
                onClick={() => setSelectedHostel('h-mandakini')}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
                  normalizedCurrentHostel === 'h-mandakini' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                GH (Kavita Ma&apos;am)
              </button>
              <button
                type="button"
                onClick={() => setSelectedHostel('h-nilgiri')}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
                  normalizedCurrentHostel === 'h-nilgiri' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                BH2 (Pathak Sir)
              </button>
            </div>
          )}

          <div className="flex flex-wrap bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setChartMode('comparative')}
              className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                chartMode === 'comparative' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Hostel Breakdown
            </button>
            <button
              type="button"
              onClick={() => setChartMode('daily_trend')}
              className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                chartMode === 'daily_trend' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              7-Day Trend
            </button>
          </div>
        </div>
      </div>

      {/* Legend & Filter Bar */}
      <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-600">Categories:</span>
          {metricConfigs.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveMetricFilter(activeMetricFilter === m.key ? 'all' : (m.key as any))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${
                activeMetricFilter === m.key
                  ? 'border-slate-800 bg-slate-900 text-white font-bold'
                  : activeMetricFilter === 'all'
                  ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  : 'opacity-40 border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-xs ${m.color}`} />
              <span>{m.label}</span>
            </button>
          ))}
          {activeMetricFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveMetricFilter('all')}
              className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
              Reset filter
            </button>
          )}
        </div>

        <div className="text-slate-500 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>On-time cutoff: <strong>7:30 PM</strong> | Late through: <strong>10:00 PM</strong></span>
        </div>
      </div>

      {/* Main Chart Body */}
      <div className="p-5">
        {chartMode === 'comparative' ? (
          /* COMPARATIVE BAR CHART BY HOSTEL FOR SELECTED DATE */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Hostel Distribution on {currentDayData.label} ({currentDayData.date})
                </h4>
                <p className="text-xs text-slate-500">
                  Showing active residents, present check-ins, late grace entries, approved leaves, and defaulters.
                </p>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${displayedHostels.length === 1 ? 'max-w-xl mx-auto' : 'md:grid-cols-3'} gap-5`}>
              {displayedHostels.map((hostel: HostelMetricData) => (
                <div
                  key={hostel.hostelId}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all hover:border-blue-300 hover:shadow-xs"
                >
                  {/* Card Title */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded">
                          {hostel.code}
                        </span>
                        <h5 className="font-bold text-slate-900 text-sm">{hostel.hostelName}</h5>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Warden: <strong>{hostel.warden}</strong></p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Total Capacity</span>
                      <span className="text-xs font-bold text-slate-800">{hostel.capacity} beds ({hostel.enrolled} active)</span>
                    </div>
                  </div>

                  {/* Grouped Vertical Bar Visualization */}
                  <div className="mt-4 pt-2">
                    <div className="h-44 flex items-end justify-between gap-3 px-2 border-b border-slate-200 pb-2">
                      {/* Bar 1: Present */}
                      {(activeMetricFilter === 'all' || activeMetricFilter === 'present') && (
                        <div
                          className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
                          onMouseEnter={() => setHoveredBar(`${hostel.hostelId}-present`)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          <span className="text-xs font-bold text-emerald-700 opacity-90 group-hover:scale-110 transition-transform">
                            {hostel.present}
                          </span>
                          <div
                            className="w-full max-w-[42px] bg-emerald-500 rounded-t-md transition-all group-hover:brightness-110 shadow-xs"
                            style={{ height: `${computeBarHeight(hostel.present, maxBarValue, 130, 8)}px` }}
                          />
                          <span className="text-[11px] font-medium text-slate-600 mt-1">Present</span>
                        </div>
                      )}

                      {/* Bar 2: Late */}
                      {(activeMetricFilter === 'all' || activeMetricFilter === 'late') && (
                        <div
                          className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
                          onMouseEnter={() => setHoveredBar(`${hostel.hostelId}-late`)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          <span className="text-xs font-bold text-amber-700 opacity-90 group-hover:scale-110 transition-transform">
                            {hostel.late}
                          </span>
                          <div
                            className="w-full max-w-[42px] bg-amber-500 rounded-t-md transition-all group-hover:brightness-110 shadow-xs"
                            style={{ height: `${computeBarHeight(hostel.late, maxBarValue, 130, 8)}px` }}
                          />
                          <span className="text-[11px] font-medium text-slate-600 mt-1">Late (Grace)</span>
                        </div>
                      )}

                      {/* Bar 3: Leave */}
                      {(activeMetricFilter === 'all' || activeMetricFilter === 'leave') && (
                        <div
                          className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
                          onMouseEnter={() => setHoveredBar(`${hostel.hostelId}-leave`)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          <span className="text-xs font-bold text-sky-700 opacity-90 group-hover:scale-110 transition-transform">
                            {hostel.leave}
                          </span>
                          <div
                            className="w-full max-w-[42px] bg-sky-500 rounded-t-md transition-all group-hover:brightness-110 shadow-xs"
                            style={{ height: `${computeBarHeight(hostel.leave, maxBarValue, 130, 8)}px` }}
                          />
                          <span className="text-[11px] font-medium text-slate-600 mt-1">Leave</span>
                        </div>
                      )}

                      {/* Bar 4: Defaulters */}
                      {(activeMetricFilter === 'all' || activeMetricFilter === 'defaulters') && (
                        <div
                          className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
                          onMouseEnter={() => setHoveredBar(`${hostel.hostelId}-defaulters`)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          <span className="text-xs font-bold text-red-700 opacity-90 group-hover:scale-110 transition-transform">
                            {hostel.defaulters}
                          </span>
                          <div
                            className="w-full max-w-[42px] bg-red-500 rounded-t-md transition-all group-hover:brightness-110 shadow-xs"
                            style={{ height: `${computeBarHeight(hostel.defaulters, maxBarValue, 130, 8)}px` }}
                          />
                          <span className="text-[11px] font-bold text-red-600 mt-1">Defaulters</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Metric Badge */}
                  <div className="mt-4 text-xs">
                    <div className="p-2 rounded-lg bg-red-50 border border-red-100 flex items-center justify-between">
                      <span className="text-red-800 font-medium">Defaulters</span>
                      <span className="font-bold text-red-900">{hostel.defaulters} students</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* 7-DAY DIVERSE COMPARATIVE BAR TREND */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  7-Day Historical Daily Variance Bar Chart ({multiDayHistory[0]?.label} – {multiDayHistory[multiDayHistory.length - 1]?.label})
                </h4>
                <p className="text-xs text-slate-500">
                  {normalizedCurrentHostel === 'all'
                    ? 'Total daily counts across all 3 hostels (BH1, GH, BH2).'
                    : `Filtered to ${displayedHostels[0]?.hostelName || selectedHostel}.`}{' '}
                  Click any day to audit detailed rosters.
                </p>
              </div>
              <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                Audited Cut-off Time: <strong className="text-slate-800">7:30 PM IST</strong>
              </div>
            </div>

            {/* 7-Day Grouped Bars Grid */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[700px] h-64 flex items-end justify-between gap-4 border-b border-slate-200 px-3 pb-2">
                {multiDayHistory.map((day) => {
                  const dataForScope = normalizedCurrentHostel === 'all'
                    ? {
                        present: day.consolidated.present,
                        late: day.consolidated.late,
                        leave: day.consolidated.leave,
                        defaulters: day.consolidated.defaulters
                      }
                    : day.hostels.find((h) => normalizeHostelId(h.hostelId) === normalizedCurrentHostel) || {
                        present: 0,
                        late: 0,
                        leave: 0,
                        defaulters: 0
                      };

                  const isCurrent = day.date === selectedChartDate;

                  return (
                    <div
                      key={day.date}
                      onClick={() => {
                        setSelectedChartDate(day.date);
                        onDateChange?.(day.date);
                      }}
                      className={`flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      {/* Bars Group */}
                      <div className="w-full flex items-end justify-center gap-1.5 h-44">
                        {/* Present Bar */}
                        {(activeMetricFilter === 'all' || activeMetricFilter === 'present') && (
                          <div
                            title={`Present: ${dataForScope.present}`}
                            className="flex-1 max-w-[16px] bg-emerald-500 rounded-t-sm hover:brightness-110 transition-all"
                            style={{ height: `${computeBarHeight(dataForScope.present, maxTrendValue, 150, 6)}px` }}
                          />
                        )}

                        {/* Late Bar */}
                        {(activeMetricFilter === 'all' || activeMetricFilter === 'late') && (
                          <div
                            title={`Late (Grace): ${dataForScope.late}`}
                            className="flex-1 max-w-[16px] bg-amber-500 rounded-t-sm hover:brightness-110 transition-all"
                            style={{ height: `${computeBarHeight(dataForScope.late, maxTrendValue, 150, 6)}px` }}
                          />
                        )}

                        {/* Leave Bar */}
                        {(activeMetricFilter === 'all' || activeMetricFilter === 'leave') && (
                          <div
                            title={`Leave: ${dataForScope.leave}`}
                            className="flex-1 max-w-[16px] bg-sky-500 rounded-t-sm hover:brightness-110 transition-all"
                            style={{ height: `${computeBarHeight(dataForScope.leave, maxTrendValue, 150, 6)}px` }}
                          />
                        )}

                        {/* Defaulter Bar */}
                        {(activeMetricFilter === 'all' || activeMetricFilter === 'defaulters') && (
                          <div
                            title={`Defaulters: ${dataForScope.defaulters}`}
                            className="flex-1 max-w-[16px] bg-red-500 rounded-t-sm hover:brightness-110 transition-all"
                            style={{ height: `${computeBarHeight(dataForScope.defaulters, maxTrendValue, 150, 6)}px` }}
                          />
                        )}
                      </div>

                      {/* Day Label */}
                      <div className="text-center mt-1">
                        <span className={`text-xs block font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-800'}`}>
                          {day.label.split(',')[1] || day.label}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          P:{dataForScope.present} | D:{dataForScope.defaulters}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Notes on Cutoff & Grace Logic */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Standard Biometric Cut-Off: <strong>7:30 PM IST</strong></span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Late window: <strong>7:30 PM through 10:00 PM</strong></span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span>After 10:00 PM: <strong>Defaulter; no-punch evaluation at 10:00 PM</strong></span>
        </div>
        <div className="text-slate-500">
          Supervised by <strong>Dr. S.K. Pradhan</strong> (Director) &amp; <strong>Prof. Sameer Varma</strong> (Chief Warden)
        </div>
      </div>
    </div>
  );
};
