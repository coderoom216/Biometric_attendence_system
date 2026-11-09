import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  AlertOctagon,
  Cpu,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  ShieldCheck,
  Calendar,
  Clock,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';
import { Hostel, AttendanceRecord, BiometricDevice } from '../types';
import { HostelAttendanceBarChart } from '../components/dashboard/HostelAttendanceBarChart';
import { WarningTicketsTable } from '../components/dashboard/WarningTicketsTable';
import { DefaultersRoster } from '../components/dashboard/DefaultersRoster';
import { LatePunchesRoster } from '../components/dashboard/LatePunchesRoster';

export const ChiefWardenDashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-27');
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [defaulters, setDefaulters] = useState<AttendanceRecord[]>([]);
  const [latePunches, setLatePunches] = useState<AttendanceRecord[]>([]);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async (date: string = selectedDate) => {
    setIsLoading(true);
    try {
      const hRes = await apiService.getHostels();
      if (hRes.success) setHostels(hRes.hostels);

      const repRes = await apiService.getReportSummary(date);
      if (repRes.success) setReportData(repRes);

      const defRes = await apiService.getDefaulters(date);
      if (defRes.success) setDefaulters(defRes.defaulters);

      const lateRes = await apiService.getLatePunches(date);
      if (lateRes.success) setLatePunches(lateRes.latePunches);

      const devRes = await apiService.getBiometricDevices();
      if (devRes.success) setDevices(devRes.devices);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const consolidated = reportData?.consolidated;
  const hostelReports = reportData?.hostelReports || [];

  return (
    <div className="space-y-6">
      {/* Scope Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Chief Warden Oversight Portal</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Institution-Wide Access (All Hostels)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Prof. Sameer Varma • Consolidated monitoring of Boys Hostel 1 (120), Girls Hostel (110), and Boys Hostel 2 (120)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href={`/api/reports/export-defaulters-csv?date=${selectedDate}`}
            download
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Defaulters CSV</span>
          </a>
          <button
            onClick={() => loadData(selectedDate)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
            <label htmlFor="chief-warden-date-picker" className="text-slate-600 font-medium">Audit Date:</label>
            <input
              id="chief-warden-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-white text-slate-900 text-xs font-mono px-2 py-1 rounded border border-slate-300 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="text-xs text-slate-500 hidden md:block font-mono">
            Auditing records for: <span className="text-slate-900 font-bold">{selectedDate}</span>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Presets:</span>
          {['2026-10-27', '2026-10-26', '2026-10-25', '2026-10-24', '2026-10-23'].map((d) => (
            <button
              key={d}
              onClick={() => handleDateChange(d)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                selectedDate === d
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {d.slice(5)}
            </button>
          ))}
        </div>
      </div>

      {/* Institutional Macro KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Total Enrolled</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{consolidated?.totalEnrolled || 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">3 Campus Hostels</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Present</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{consolidated?.totalPresent || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Turnstile logs</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Late Punches</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{consolidated?.totalLate || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pre-7:00 PM</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Approved Leave</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{consolidated?.totalLeave || 0}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Alerts suppressed</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">9:00 PM Defaulters</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{consolidated?.totalDefaulters || 0}</div>
          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">6-Tier Alert Active</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Overall Compliance</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{consolidated?.overallComplianceRate || 0}%</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Target: 85%</div>
        </div>
      </div>

      {/* Hostel-wise Comparative Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {hostelReports.map((h: any) => (
          <div key={h.hostelId} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{h.hostelName}</h3>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{h.type} Hostel ({h.code})</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${h.complianceRate >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {h.complianceRate}% Compliance
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 text-center text-xs py-1">
              <div className="bg-slate-50 p-1.5 rounded">
                <div className="text-[9px] text-slate-400 font-medium uppercase">Active</div>
                <div className="font-bold text-slate-800">{h.totalEnrolled || 100}</div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded">
                <div className="text-[9px] text-emerald-700 font-medium uppercase">Present</div>
                <div className="font-bold text-emerald-800">{h.present || 80}</div>
              </div>
              <div className="bg-amber-50 p-1.5 rounded">
                <div className="text-[9px] text-amber-700 font-medium uppercase">Late</div>
                <div className="font-bold text-amber-800">{h.late || 10}</div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded">
                <div className="text-[9px] text-blue-700 font-medium uppercase">Leave</div>
                <div className="font-bold text-blue-800">{h.leave || 5}</div>
              </div>
              <div className="bg-rose-50 p-1.5 rounded">
                <div className="text-[9px] text-rose-700 font-medium uppercase">Defaulter</div>
                <div className="font-bold text-rose-800">{h.defaulters || 5}</div>
              </div>
            </div>

            {/* Block-wise breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="text-[10px] font-semibold uppercase text-slate-400">Block Performance</div>
              {h.blockStats?.map((b: any) => (
                <div key={b.block} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                  <span className="font-medium text-slate-700">{b.block}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-500">{b.present + b.late + b.leave} / {b.total}</span>
                    <span className="font-mono text-slate-800 font-semibold">{b.complianceRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Date-Wise Hostel Attendance & Defaulter Comparative Bar Chart */}
      <HostelAttendanceBarChart
        currentDate={selectedDate}
        hostelId="all"
        allowHostelSwitch={true}
        onDateChange={handleDateChange}
      />

      {/* Institution-Wide Post-Grace Cutoff Defaulters Roster */}
      <DefaultersRoster
        records={defaulters}
        targetDate={selectedDate}
        role="chief_warden"
      />

      {/* Institution-Wide Late Punches Roster (Grace Window: 7:00 PM - 9:00 PM) */}
      <LatePunchesRoster
        records={latePunches}
        targetDate={selectedDate}
        role="chief_warden"
      />

      {/* Automated Strike Records & Disciplinary Warning Tickets */}
      <WarningTicketsTable role="chief_warden" />

      {/* Biometric Integration Health for Chief Warden */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>Campus Biometric Terminals Status (Mr. Mehra's Channel)</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">Mr. Mehra (Computer Science Dept)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {devices.map((dev) => (
            <div key={dev.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{dev.name}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${dev.status === 'online_synced' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {dev.status === 'online_synced' ? 'Synced' : 'Stale (>24h)'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">ID: {dev.deviceId} • {dev.location}</div>
              <div className="text-[11px] text-slate-600 flex justify-between">
                <span>Last Synchronized:</span>
                <span className="font-mono font-medium">{dev.lastSyncAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
