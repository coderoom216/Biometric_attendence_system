import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  AlertOctagon,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  BarChart3,
  Mail,
  Cpu,
  Activity,
  FileCheck2,
  Download,
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceRecord, ScheduledJobLog, NotificationLog } from '../types';
import { HostelAttendanceBarChart } from '../components/dashboard/HostelAttendanceBarChart';
import { WarningTicketsTable } from '../components/dashboard/WarningTicketsTable';
import { DefaultersRoster } from '../components/dashboard/DefaultersRoster';
import { LatePunchesRoster } from '../components/dashboard/LatePunchesRoster';

export const DirectorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-27');
  const [reportData, setReportData] = useState<any>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [defaulters, setDefaulters] = useState<AttendanceRecord[]>([]);
  const [latePunches, setLatePunches] = useState<AttendanceRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDataForDate = async (date: string) => {
    setIsLoading(true);
    try {
      const repRes = await apiService.getReportSummary(date);
      if (repRes.success) setReportData(repRes);

      const schRes = await apiService.getSchedulerStatus();
      if (schRes.success) setSchedulerStatus(schRes);

      const defRes = await apiService.getDefaulters(date);
      if (defRes.success) setDefaulters(defRes.defaulters);

      const lateRes = await apiService.getLatePunches(date);
      if (lateRes.success) setLatePunches(lateRes.latePunches);

      const notifRes = await apiService.getNotificationLogs({ date });
      if (notifRes.success) setNotifications(notifRes.logs);

      const auditRes = await apiService.getAuditLogs();
      if (auditRes.success) setAuditLogs(auditRes.logs.slice(0, 8));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDataForDate(selectedDate);
  }, [selectedDate]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const consolidated = reportData?.consolidated;
  const hostelReports = reportData?.hostelReports || [];
  const scheduledJobs: ScheduledJobLog[] = (schedulerStatus?.scheduledJobs || []).filter(
    (j: ScheduledJobLog) => !selectedDate || j.dateEvaluated === selectedDate
  );

  return (
    <div className="space-y-6">
      {/* Director Header with Integrated Date Filter */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Director's Office
              </span>
              <span className="text-xs text-slate-400 font-mono">Cutoff: 19:00 IST Strictly</span>
              <span className="text-xs text-indigo-300 font-semibold bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-700/50">
                Director: {user?.name}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1.5">
              Hostel Attendance Strategic Overview
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Director Sir's Administrative Oversight • Campus-wide Defaulter & Sequential Notification Monitoring
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={`/api/reports/export-attendance-csv?date=${selectedDate}`}
              download
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {selectedDate} CSV</span>
            </a>
            <button
              onClick={() => loadDataForDate(selectedDate)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-lg">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <label htmlFor="director-date-picker" className="text-xs text-slate-300 font-medium">Select Date:</label>
              <input
                id="director-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-slate-900 text-white text-xs font-mono px-2 py-1 rounded border border-slate-600 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="text-xs text-slate-400 hidden lg:block font-mono">
              Viewing records for: <span className="text-white font-bold">{selectedDate}</span>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Quick Presets:</span>
            <button
              onClick={() => handleDateChange('2026-10-27')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedDate === '2026-10-27'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              Today (Oct 27)
            </button>
            <button
              onClick={() => handleDateChange('2026-10-26')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedDate === '2026-10-26'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              Yesterday (Oct 26)
            </button>
            <button
              onClick={() => handleDateChange('2026-10-25')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedDate === '2026-10-25'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              Oct 25
            </button>
          </div>
        </div>
      </div>

      {/* High-level Director KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Active Residents</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{consolidated?.totalEnrolled || 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">3 Hostels Active</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Present Rate</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{consolidated?.totalPresent || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">On-time biometric</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Late Punches</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{consolidated?.totalLate || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pre-cutoff entry</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Approved Leave</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{consolidated?.totalLeave || 0}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Alerts suppressed</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Defaulters (9:00 PM)</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{consolidated?.totalDefaulters || 0}</div>
          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">Missing students</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Institutional Compliance</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{consolidated?.overallComplianceRate || 0}%</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Selected Date: {selectedDate}</div>
        </div>
      </div>

      {/* Hostel & Block Strategic Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              Hostel Breakdown — Boys Hostel 1 (120), Girls Hostel (110), Boys Hostel 2 (120)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">Date: {selectedDate}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {hostelReports.map((h: any) => {
            const wardenDisplayName =
              h.hostelId === 'h-shivalik'
                ? 'Dr. Sati Sir'
                : h.hostelId === 'h-mandakini'
                ? 'Dr. Kavita Tariyal'
                : 'Dr. Pathak Sir';

            const capacityDisplay =
              h.hostelId === 'h-shivalik'
                ? 120
                : h.hostelId === 'h-mandakini'
                ? 110
                : 120;

            return (
              <div key={h.hostelId} className="border border-slate-200 rounded-lg p-4 bg-slate-50/60 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900">{h.hostelName}</div>
                    <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Warden: <strong className="text-slate-900">{wardenDisplayName}</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">
                      Strength: {capacityDisplay} beds ({h.code})
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${h.complianceRate >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {h.complianceRate}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                  <div style={{ width: `${(h.present / (h.totalEnrolled || 1)) * 100}%` }} className="bg-emerald-500" title="Present" />
                  <div style={{ width: `${(h.late / (h.totalEnrolled || 1)) * 100}%` }} className="bg-amber-400" title="Late" />
                  <div style={{ width: `${(h.leave / (h.totalEnrolled || 1)) * 100}%` }} className="bg-blue-400" title="Leave" />
                  <div style={{ width: `${(h.defaulters / (h.totalEnrolled || 1)) * 100}%` }} className="bg-rose-500" title="Defaulters" />
                </div>

                {/* Metric pill strip */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-600 bg-white px-2 py-1 rounded border border-slate-100">
                    <span>Active Residents:</span>
                    <strong className="text-slate-900">{h.totalEnrolled || 100}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-700 bg-emerald-50/70 px-2 py-1 rounded border border-emerald-100">
                    <span>Present:</span>
                    <strong className="font-bold">{h.present || 80}</strong>
                  </div>
                  <div className="flex justify-between text-amber-700 bg-amber-50/70 px-2 py-1 rounded border border-amber-100">
                    <span>Late Punch:</span>
                    <strong className="font-bold">{h.late || 10}</strong>
                  </div>
                  <div className="flex justify-between text-blue-700 bg-blue-50/70 px-2 py-1 rounded border border-blue-100">
                    <span>Approved Leave:</span>
                    <strong className="font-bold">{h.leave || 5}</strong>
                  </div>
                  <div className="flex justify-between text-rose-700 bg-rose-50/70 px-2 py-1 rounded border border-rose-100">
                    <span>9:00 PM Defaulters:</span>
                    <strong className="font-bold">{h.defaulters || 5}</strong>
                  </div>
                  <div className="flex justify-between text-indigo-700 bg-indigo-50/70 px-2 py-1 rounded border border-indigo-100">
                    <span>Compliance:</span>
                    <strong className="font-bold">{h.complianceRate || 95}%</strong>
                  </div>
                </div>

                <div className="space-y-1 pt-1 text-[11px]">
                  {h.blockStats?.map((b: any) => (
                    <div key={b.block} className="flex justify-between text-slate-600 py-0.5 border-b border-slate-100/60 last:border-0">
                      <span>{b.block}:</span>
                      <span className="font-medium text-slate-900">{b.present + b.late + b.leave} / {b.total} ({b.complianceRate}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
        role="director"
      />

      {/* Institution-Wide Late Punches Roster (Grace Window: 7:00 PM - 9:00 PM) */}
      <LatePunchesRoster
        records={latePunches}
        targetDate={selectedDate}
        role="director"
      />

      {/* 6-Tier Notification Hierarchy Execution Monitor (FR-08) for Selected Date */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              6-Tier Absence Alert Escalation Hierarchy (FR-08) — {selectedDate}
            </h2>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium">
            Sequential Protocol: RW → Warden → CW (Prof. Sameer Varma) → Director → Parents → Student
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Escalation Tier</th>
                <th className="py-2.5 px-3">Recipient Role</th>
                <th className="py-2.5 px-3">Target Student</th>
                <th className="py-2.5 px-3">Recipient Contact</th>
                <th className="py-2.5 px-3">Delivery Status</th>
                <th className="py-2.5 px-3">Dispatched Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No notification escalation records logged for {selectedDate}.
                  </td>
                </tr>
              ) : (
                notifications.slice(0, 8).map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px]">
                        Tier {n.tier}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{n.recipientRole}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{n.studentName} ({n.enrollmentNo})</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">{n.recipientEmail || <span className="text-rose-500 font-bold">Missing Email</span>}</td>
                    <td className="py-2.5 px-3">
                      {n.status === 'delivered' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center w-fit">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Delivered
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 flex items-center w-fit" title={n.failureReason}>
                          <AlertOctagon className="w-3 h-3 mr-1" /> Failed ({n.failureReason?.slice(0, 25)}...)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{n.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automated Strike Records & Disciplinary Warning Tickets */}
      <WarningTicketsTable role="director" />

      {/* Scheduler Execution & Audit Trail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scheduler Job History (FR-06) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>7:00 PM IST Scheduler Execution Logs (FR-06)</span>
            </div>
            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
              Active Job
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {scheduledJobs.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                No scheduler jobs recorded for {selectedDate}.
              </div>
            ) : (
              scheduledJobs.map((job) => (
                <div key={job.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{job.jobName}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {job.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Executed: {job.executedAt} • Evaluated {job.totalStudents} students
                  </div>
                  <div className="text-[11px] text-slate-700 flex space-x-3 pt-0.5">
                    <span className="text-emerald-700 font-semibold">Present: {job.presentCount}</span>
                    <span className="text-amber-700 font-semibold">Late: {job.lateCount}</span>
                    <span className="text-blue-700 font-semibold">Leave: {job.leaveCount}</span>
                    <span className="text-rose-700 font-bold">Defaulters: {job.defaultersCount}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
              <Activity className="w-4 h-4 text-purple-600" />
              <span>Security & Administrative Audit Logs</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">Immutable</span>
          </div>

          <div className="space-y-2 text-xs max-h-[260px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 bg-slate-50 rounded border border-slate-100 text-slate-700 text-[11px]">
                <div className="flex justify-between items-center text-slate-500 text-[10px] mb-0.5">
                  <span className="font-semibold text-purple-700">{log.action}</span>
                  <span className="font-mono">{log.timestamp}</span>
                </div>
                <div className="font-medium text-slate-800">{log.performedByUserName}: {log.details}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
