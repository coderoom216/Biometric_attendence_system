import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck2,
  Layers,
  ArrowUpDown
} from 'lucide-react';

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
  hostelId?: string; // 'all' | 'h-shivalik' | 'h-mandakini' | 'h-nilgiri'
  allowHostelSwitch?: boolean;
  onDateChange?: (date: string) => void;
}

export const HostelAttendanceBarChart: React.FC<HostelAttendanceBarChartProps> = ({
  currentDate = '2026-10-27',
  hostelId = 'all',
  allowHostelSwitch = true,
  onDateChange
}) => {
  const [selectedHostel, setSelectedHostel] = useState<string>(hostelId);
  const [selectedChartDate, setSelectedChartDate] = useState(currentDate);
  const [chartMode, setChartMode] = useState<'comparative' | 'daily_trend'>('comparative');
  const [activeMetricFilter, setActiveMetricFilter] = useState<'all' | 'present' | 'late' | 'leave' | 'defaulters'>('all');
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  useEffect(() => {
    setSelectedChartDate(currentDate);
  }, [currentDate]);

  useEffect(() => {
    setSelectedHostel(hostelId);
  }, [hostelId]);

  // High-fidelity multi-day history matching exact specifications
  const multiDayHistory: DayBarData[] = [
    {
      date: '2026-10-22',
      label: 'Thu, Oct 22',
      hostels: [
        { hostelId: 'h-shivalik', hostelName: 'Boys Hostel 1', code: 'BH1', warden: 'Mr. Sachin Sati', capacity: 120, enrolled: 100, present: 87, late: 6, leave: 4, defaulters: 3, complianceRate: 97 },
        { hostelId: 'h-mandakini', hostelName: 'Girls Hostel', code: 'GH', warden: 'Dr. Kavita Tariyal', capacity: 110, enrolled: 100, present: 89, late: 5, leave: 4, defaulters: 2, complianceRate: 98 },
        { hostelId: 'h-nilgiri', hostelName: 'Boys Hostel 2', code: 'BH2', warden: 'Dr. Pathak Sir', capacity: 120, enrolled: 100, present: 85, late: 7, leave: 5, defaulters: 3, complianceRate: 97 }
      ],
      consolidated: { enrolled: 300, present: 261, late: 18, leave: 13, defaulters: 8, complianceRate: 97.3 }
    },
    {
      date: '2026-10-23',
      label: 'Fri, Oct 23',
      hostels: [
        { hostelId: 'h-shivalik', hostelName: 'Boys Hostel 1', code: 'BH1', warden: 'Mr. Sachin Sati', capacity: 120, enrolled: 100, present: 73, late: 16, leave: 4, defaulters: 7, complianceRate: 93 },
        { hostelId: 'h-mandakini', hostelName: 'Girls Hostel', code: 'GH', warden: 'Dr. Kavita Tariyal', capacity: 110, enrolled: 100, present: 78, late: 13, leave: 5, defaulters: 4, complianceRate: 96 },
        { hostelId: 'h-nilgiri', hostelName: 'Boys Hostel 2', code: 'BH2', warden: 'Dr. Pathak Sir', capacity: 120, enrolled: 100, present: 74, late: 15, leave: 5, defaulters: 6, complianceRate: 94 }
      ],
      consolidated: { enrolled: 300, present: 225, late: 44, leave: 14, defaulters: 17, complianceRate: 94.3 }
    },
    {
      date: '2026-10-24',
      label: 'Sat, Oct 24',
      hostels: [
        { hostelId: 'h-shivalik', hostelName: 'Boys Hostel 1', code: 'BH1', warden: 'Mr. Sachin Sati', capacity: 120, enrolled: 100, present: 84, late: 8, leave: 5, defaulters: 3, complianceRate: 97 },
        { hostelId: 'h-mandakini', hostelName: 'Girls Hostel', code: 'GH', warden: 'Dr. Kavita Tariyal', capacity: 110, enrolled: 100, present: 85, late: 8, leave: 5, defaulters: 2, complianceRate: 98 },
        { hostelId: 'h-nilgiri', hostelName: 'Boys Hostel 2', code: 'BH2', warden: 'Dr. Pathak Sir', capacity: 120, enrolled: 100, present: 81, late: 10, leave: 6, defaulters: 3, complianceRate: 97 }
      ],
      consolidated: { enrolled: 300, present: 250, late: 26, leave: 16, defaulters: 8, complianceRate: 97.3 }
    },
    {
      date: '2026-10-25',
      label: 'Sun, Oct 25',
      hostels: [
        { hostelId: 'h-shivalik', hostelName: 'Boys Hostel 1', code: 'BH1', warden: 'Mr. Sachin Sati', capacity: 120, enrolled: 100, present: 68, late: 15, leave: 11, defaulters: 6, complianceRate: 94 },
        { hostelId: 'h-mandakini', hostelName: 'Girls Hostel', code: 'GH', warden: 'Dr. Kavita Tariyal', capacity: 110, enrolled: 100, present: 72, late: 12, leave: 12, defaulters: 4, complianceRate: 96 },
        { hostelId: 'h-nilgiri', hostelName: 'Boys Hostel 2', code: 'BH2', warden: 'Dr. Pathak Sir', capacity: 120, enrolled: 100, present: 70, late: 14, leave: 10, defaulters: 6, complianceRate: 94 }
      ],
      consolidated: { enrolled: 300, present: 210, late: 41, leave: 33, defaulters: 16, complianceRate: 94.7 }
    },
    {
      date: '2026-10-26',
      label: 'Mon, Oct 26',
      hostels: [
        { hostelId: 'h-shivalik', hostelName: 'Boys Hostel 1', code: 'BH1', warden: 'Mr. Sachin Sati', capacity: 120, enrolled: 100, present: 83, late: 9, leave: 4, defaulters: 4, complianceRate: 96 },
        { hostelId: 'h-mandakini', hostelName: 'Girls Hostel', code: 'GH', warden: 'Dr. Kavita Tariyal', capacity: 110, enrolled: 100, present: 86, late: 7, leave: 4, defaulters: 3, complianceRate: 97 },
        { hostelId: 'h-nilgiri', hostelName: 'Boys Hostel 2', code: 'BH2', warden: 'Dr. Pathak Sir', capacity: 120, enrolled: 100, present: 82, late: 9, leave: 5, defaulters: 4, complianceRate: 96 }
      ],
      consolidated: { enrolled: 300, present: 251, late: 25, leave: 13, defaulters: 11, complianceRate: 96.3 }
    },
    {
      date: '2026-10-27',
      label: 'Tue, Oct 27',
      hostels: [
        { hostelId: 'h-shivalik', hostelName: 'Boys Hostel 1', code: 'BH1', warden: 'Mr. Sachin Sati', capacity: 120, enrolled: 100, present: 80, late: 10, leave: 5, defaulters: 5, complianceRate: 95 },
        { hostelId: 'h-mandakini', hostelName: 'Girls Hostel', code: 'GH', warden: 'Dr. Kavita Tariyal', capacity: 110, enrolled: 100, present: 80, late: 10, leave: 5, defaulters: 5, complianceRate: 95 },
        { hostelId: 'h-nilgiri', hostelName: 'Boys Hostel 2', code: 'BH2', warden: 'Dr. Pathak Sir', capacity: 120, enrolled: 100, present: 80, late: 10, leave: 5, defaulters: 5, complianceRate: 95 }
      ],
      consolidated: { enrolled: 300, present: 240, late: 30, leave: 15, defaulters: 15, complianceRate: 95.0 }
    },
    {
      date: '2026-10-28',
      label: 'Wed, Oct 28',
      hostels: [
        { hostelId: 'h-shivalik', hostelName: 'Boys Hostel 1', code: 'BH1', warden: 'Mr. Sachin Sati', capacity: 120, enrolled: 100, present: 85, late: 8, leave: 3, defaulters: 4, complianceRate: 96 },
        { hostelId: 'h-mandakini', hostelName: 'Girls Hostel', code: 'GH', warden: 'Dr. Kavita Tariyal', capacity: 110, enrolled: 100, present: 88, late: 6, leave: 4, defaulters: 2, complianceRate: 98 },
        { hostelId: 'h-nilgiri', hostelName: 'Boys Hostel 2', code: 'BH2', warden: 'Dr. Pathak Sir', capacity: 120, enrolled: 100, present: 83, late: 9, leave: 4, defaulters: 4, complianceRate: 96 }
      ],
      consolidated: { enrolled: 300, present: 256, late: 23, leave: 11, defaulters: 10, complianceRate: 96.7 }
    }
  ];

  // Active day data
  const currentDayData = multiDayHistory.find((d) => d.date === selectedChartDate) || multiDayHistory[5];

  // Effective hostels to display
  const displayedHostels = selectedHostel === 'all'
    ? currentDayData.hostels
    : currentDayData.hostels.filter((h) => h.hostelId === selectedHostel);

  // Metrics colors and metadata
  const metricConfigs = [
    { key: 'present', label: 'Present On-Time (<= 7:00 PM)', color: 'bg-emerald-500', barHex: '#10b981', textColor: 'text-emerald-700', badgeBg: 'bg-emerald-50' },
    { key: 'late', label: 'Late Punch (after 7:00 PM through 10:00 PM)', color: 'bg-amber-500', barHex: '#f59e0b', textColor: 'text-amber-700', badgeBg: 'bg-amber-50' },
    { key: 'leave', label: 'Approved Leave (FR-11)', color: 'bg-sky-500', barHex: '#0ea5e9', textColor: 'text-sky-700', badgeBg: 'bg-sky-50' },
    { key: 'defaulters', label: 'Defaulters (after 10:00 PM / no punch by 10:00 PM)', color: 'bg-red-500', barHex: '#ef4444', textColor: 'text-red-700', badgeBg: 'bg-red-50' }
  ];

  // Max value for bar scaling (enrolled is 100 per hostel or 300 for consolidated)
  const maxBarValue = 100;

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
                7:00 PM on-time cutoff, late punches through 10:00 PM, and 10:00 PM no-punch evaluation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 sm:self-auto">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <label htmlFor="hostel-attendance-chart-date" className="font-medium whitespace-nowrap">
              Select Date:
            </label>
            <input
              id="hostel-attendance-chart-date"
              type="date"
              value={selectedChartDate}
              min={multiDayHistory[0].date}
              max={multiDayHistory[multiDayHistory.length - 1].date}
              onChange={(event) => {
                if (!event.target.value) return;
                setSelectedChartDate(event.target.value);
                onDateChange?.(event.target.value);
              }}
              aria-label="Select chart date"
              className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {allowHostelSwitch && (
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
              <button
                onClick={() => setSelectedHostel('all')}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
                  selectedHostel === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                All Hostels (3)
              </button>
              <button
                onClick={() => setSelectedHostel('h-shivalik')}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
                  selectedHostel === 'h-shivalik' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                BH1 (Sachin Sir)
              </button>
              <button
                onClick={() => setSelectedHostel('h-mandakini')}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
                  selectedHostel === 'h-mandakini' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                GH (Kavita Ma'am)
              </button>
              <button
                onClick={() => setSelectedHostel('h-nilgiri')}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
                  selectedHostel === 'h-nilgiri' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                BH2 (Pathak Sir)
              </button>
            </div>
          )}

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
            <button
              onClick={() => setChartMode('comparative')}
              className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                chartMode === 'comparative' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Hostel Breakdown
            </button>
            <button
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
              onClick={() => setActiveMetricFilter('all')}
              className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
              Reset filter
            </button>
          )}
        </div>

        <div className="text-slate-500 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>On-time cutoff: <strong>7:00 PM</strong> | Late through: <strong>10:00 PM</strong></span>
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
                  Showing active residents (100 in each hostel), present check-ins, late grace entries, approved leaves, and defaulters.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Consolidated Compliance</span>
                <span className="text-sm font-bold text-emerald-600">{currentDayData.consolidated.complianceRate}%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {displayedHostels.map((hostel) => (
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
                      <span className="text-xs font-bold text-slate-800">{hostel.capacity} beds (100 active)</span>
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
                            style={{ height: `${(hostel.present / maxBarValue) * 130}px` }}
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
                            style={{ height: `${Math.max(12, (hostel.late / maxBarValue) * 130)}px` }}
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
                            style={{ height: `${Math.max(10, (hostel.leave / maxBarValue) * 130)}px` }}
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
                            className="w-full max-w-[42px] bg-red-500 rounded-t-md transition-all group-hover:brightness-110 shadow-xs animate-pulse"
                            style={{ height: `${Math.max(10, (hostel.defaulters / maxBarValue) * 130)}px` }}
                          />
                          <span className="text-[11px] font-bold text-red-600 mt-1">Defaulters</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                      <span className="text-emerald-800 font-medium">On-Time Rate</span>
                      <span className="font-bold text-emerald-900">{hostel.present}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-red-50 border border-red-100 flex items-center justify-between">
                      <span className="text-red-800 font-medium">Defaulter Alert</span>
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
                  7-Day Historical Daily Variance Bar Chart (Oct 22 - Oct 28)
                </h4>
                <p className="text-xs text-slate-500">
                  {selectedHostel === 'all'
                    ? 'Aggregated across all 3 hostels (BH1, GH, BH2).'
                    : `Filtered to ${displayedHostels[0]?.hostelName || selectedHostel}.`}{' '}
                  Click any day to audit detailed rosters.
                </p>
              </div>
              <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                Audited Cut-off Time: <strong className="text-slate-800">7:00 PM IST</strong>
              </div>
            </div>

            {/* 7-Day Grouped Bars Grid */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[700px] h-64 flex items-end justify-between gap-4 border-b border-slate-200 px-3 pb-2">
                {multiDayHistory.map((day) => {
                  const dataForScope = selectedHostel === 'all'
                    ? {
                        present: Math.round(day.consolidated.present / 3),
                        late: Math.round(day.consolidated.late / 3),
                        leave: Math.round(day.consolidated.leave / 3),
                        defaulters: Math.round(day.consolidated.defaulters / 3)
                      }
                    : day.hostels.find((h) => h.hostelId === selectedHostel) || {
                        present: 80,
                        late: 10,
                        leave: 5,
                        defaulters: 5
                      };

                  const isCurrent = day.date === currentDate;

                  return (
                    <div
                      key={day.date}
                      onClick={() => onDateChange && onDateChange(day.date)}
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
                            style={{ height: `${(dataForScope.present / maxBarValue) * 150}px` }}
                          />
                        )}

                        {/* Late Bar */}
                        {(activeMetricFilter === 'all' || activeMetricFilter === 'late') && (
                          <div
                            title={`Late (Grace): ${dataForScope.late}`}
                            className="flex-1 max-w-[16px] bg-amber-500 rounded-t-sm hover:brightness-110 transition-all"
                            style={{ height: `${Math.max(8, (dataForScope.late / maxBarValue) * 150)}px` }}
                          />
                        )}

                        {/* Leave Bar */}
                        {(activeMetricFilter === 'all' || activeMetricFilter === 'leave') && (
                          <div
                            title={`Leave: ${dataForScope.leave}`}
                            className="flex-1 max-w-[16px] bg-sky-500 rounded-t-sm hover:brightness-110 transition-all"
                            style={{ height: `${Math.max(6, (dataForScope.leave / maxBarValue) * 150)}px` }}
                          />
                        )}

                        {/* Defaulter Bar */}
                        {(activeMetricFilter === 'all' || activeMetricFilter === 'defaulters') && (
                          <div
                            title={`Defaulters: ${dataForScope.defaulters}`}
                            className="flex-1 max-w-[16px] bg-red-500 rounded-t-sm hover:brightness-110 transition-all"
                            style={{ height: `${Math.max(6, (dataForScope.defaulters / maxBarValue) * 150)}px` }}
                          />
                        )}
                      </div>

                      {/* Day Label */}
                      <div className="text-center mt-1">
                        <span className={`text-xs block font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-800'}`}>
                          {day.label.split(',')[1]}
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
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Standard Biometric Cut-Off: <strong>7:00 PM IST</strong></span>
          <span className="text-slate-300">|</span>
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Late window: <strong>after 7:00 PM through 10:00 PM</strong></span>
          <span className="text-slate-300">|</span>
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span>After 10:00 PM: <strong>Defaulter; no-punch evaluation at 10:00 PM</strong></span>
        </div>
        <div className="text-slate-500">
          Supervised by <strong>Dr. S.K. Pradhan</strong> (Director) & <strong>Prof. Sameer Varma</strong> (Chief Warden)
        </div>
      </div>
    </div>
  );
};
