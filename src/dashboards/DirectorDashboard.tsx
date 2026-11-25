import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  CalendarCheck,
  Clock,
  ShieldCheck,
  BarChart3,
  Cpu,
  Activity,
  FileCheck2,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceRecord, ScheduledJobLog, Student } from '../types';
import { HostelAttendanceBarChart } from '../components/dashboard/HostelAttendanceBarChart';
import { WarningTicketsTable } from '../components/dashboard/WarningTicketsTable';
import { DefaultersRoster } from '../components/dashboard/DefaultersRoster';
import { LatePunchesRoster } from '../components/dashboard/LatePunchesRoster';

type AttendanceDrilldownCategory = 'all' | 'present' | 'late' | 'approved_leave' | 'defaulters' | 'compliant';

interface AttendanceDrilldownProps {
  category: AttendanceDrilldownCategory;
  hostelId?: string;
  date: string;
  onClose: () => void;
}

const attendanceCategoryLabels: Record<AttendanceDrilldownCategory, string> = {
  all: 'Active Residents',
  present: 'Present On-Time',
  late: 'Late Punches',
  approved_leave: 'Approved Leave',
  defaulters: 'Defaulters',
  compliant: 'Compliant Residents'
};

const getAttendanceStatusLabel = (record?: AttendanceRecord) => {
  if (!record) return 'No attendance recorded';
  if (record.isDefaulter || record.status === 'absent') return 'Defaulter';
  if (record.status === 'approved_leave') return 'Approved Leave';
  if (record.status === 'late') return 'Late Punch';
  return 'Present On-Time';
};

const getAttendanceStatusClass = (record?: AttendanceRecord) => {
  if (!record) return 'bg-slate-100 text-slate-700';
  if (record.isDefaulter || record.status === 'absent') return 'bg-rose-100 text-rose-800';
  if (record.status === 'approved_leave') return 'bg-blue-100 text-blue-800';
  if (record.status === 'late') return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
};

const DirectorAttendanceDrilldown: React.FC<AttendanceDrilldownProps> = ({
  category,
  hostelId,
  date,
  onClose
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;
    setIsLoading(true);
    setError(null);

    Promise.all([
      apiService.getStudents(),
      apiService.getAttendanceHistory({ startDate: date, endDate: date })
    ])
      .then(([studentResponse, attendanceResponse]) => {
        if (!studentResponse.success || !attendanceResponse.success) {
          throw new Error('The student or attendance data could not be loaded.');
        }
        if (isCurrentRequest) {
          setStudents(studentResponse.students);
          setAttendance(attendanceResponse.records);
        }
      })
      .catch((loadError: unknown) => {
        if (isCurrentRequest) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load student attendance details.');
        }
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoading(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [category, date, hostelId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const attendanceByStudentId = new Map(attendance.map((record) => [record.studentId, record]));
  const filteredStudents = students
    .filter((student) =>
      student.checkoutStatus === 'active' &&
      student.verificationStatus === 'verified' &&
      (!hostelId || student.hostelId === hostelId)
    )
    .map((student) => ({ student, record: attendanceByStudentId.get(student.id) }))
    .filter(({ record }) => {
      if (category === 'all') return true;
      if (category === 'defaulters') return Boolean(record && (record.isDefaulter || record.status === 'absent'));
      if (category === 'compliant') return Boolean(record && ['present', 'late', 'approved_leave'].includes(record.status));
      return record?.status === category;
    })
    .filter(({ student, record }) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return [
        student.name,
        student.enrollmentNo,
        student.hostelId,
        student.block,
        student.roomNumber,
        record?.status
      ].some((value) => value?.toLowerCase().includes(query));
    })
    .sort((a, b) => a.student.name.localeCompare(b.student.name));

  const hostelNames: Record<string, string> = {
    'h-shivalik': 'Boys Hostel 1',
    'h-mandakini': 'Girls Hostel',
    'h-nilgiri': 'Boys Hostel 2'
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-drilldown-title"
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 id="attendance-drilldown-title" className="text-lg font-bold text-slate-900">
              {hostelId ? `${hostelNames[hostelId] || hostelId} — ` : ''}{attendanceCategoryLabels[category]}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Student details for {date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close student details"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, enrollment, hostel, room..."
              aria-label="Search student details"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="min-h-48 overflow-auto">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading student details...</p>
          ) : error ? (
            <p role="alert" className="p-8 text-center text-sm text-rose-700">{error}</p>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Enrollment No.</th>
                  <th className="px-4 py-3">Hostel / Block</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Punch Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No students found for this category and date.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(({ student, record }) => (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{student.name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{student.enrollmentNo}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {hostelNames[student.hostelId] || student.hostelId} / {student.block}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{student.roomNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getAttendanceStatusClass(record)}`}>
                          {getAttendanceStatusLabel(record)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{record?.punchTime || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && !error && (
          <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            Showing {filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'}
          </div>
        )}
      </section>
    </div>
  );
};

interface DirectorDashboardProps {
  officeRole?: 'director' | 'chief_warden' | 'admin';
}

export const DirectorDashboard: React.FC<DirectorDashboardProps> = ({ officeRole = 'director' }) => {
  const { user } = useAuth();
  const officeTitle = officeRole === 'chief_warden' ? 'Chief Warden' : 'Director';
  const officePossessive = officeRole === 'chief_warden' ? 'Chief Warden’s' : 'Director Sir’s';
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dayBeforeStr = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [drilldownSelection, setDrilldownSelection] = useState<{
    category: AttendanceDrilldownCategory;
    hostelId?: string;
  } | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [defaulters, setDefaulters] = useState<AttendanceRecord[]>([]);
  const [latePunches, setLatePunches] = useState<AttendanceRecord[]>([]);
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
      {/* Office Header with Integrated Date Filter */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {officeTitle}'s Office
              </span>
              <span className="whitespace-nowrap text-xs text-indigo-300 font-semibold bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-700/50">
                {officeTitle}: {user?.name}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1.5">
              Hostel Attendance Strategic Overview
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {officePossessive} Administrative Oversight • Campus-wide Defaulter & Sequential Notification Monitoring
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start">
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
              onClick={() => handleDateChange(todayStr)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedDate === todayStr
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleDateChange(yesterdayStr)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedDate === yesterdayStr
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => handleDateChange(dayBeforeStr)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedDate === dayBeforeStr
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              2 Days Ago
            </button>
          </div>
        </div>
      </div>

      {/* High-level Director KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => setDrilldownSelection({ category: 'all' })}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
          aria-label="View all active residents"
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase">Active Residents</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{consolidated?.totalEnrolled ?? consolidated?.totalStudents ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">3 Hostels Active</div>
          <div className="mt-1 text-[10px] font-medium text-indigo-600">Click to view students</div>
        </button>

        <button
          type="button"
          onClick={() => setDrilldownSelection({ category: 'present' })}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
          aria-label="View students present on time"
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase">Present Rate</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{consolidated?.totalPresent ?? consolidated?.presentCount ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">On-time biometric</div>
          <div className="mt-1 text-[10px] font-medium text-indigo-600">Click to view students</div>
        </button>

        <button
          type="button"
          onClick={() => setDrilldownSelection({ category: 'late' })}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
          aria-label="View students with late punches"
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase">Late Punches</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{consolidated?.totalLate ?? consolidated?.lateCount ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pre-cutoff entry</div>
          <div className="mt-1 text-[10px] font-medium text-indigo-600">Click to view students</div>
        </button>

        <button
          type="button"
          onClick={() => setDrilldownSelection({ category: 'approved_leave' })}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
          aria-label="View students on approved leave"
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase">Approved Leave</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{consolidated?.totalLeave ?? consolidated?.leaveCount ?? 0}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Alerts suppressed</div>
          <div className="mt-1 text-[10px] font-medium text-indigo-600">Click to view students</div>
        </button>

        <button
          type="button"
          onClick={() => setDrilldownSelection({ category: 'defaulters' })}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
          aria-label="View defaulters"
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase">Defaulters (After 10:00 PM / No-Punch Check)</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{consolidated?.totalDefaulters ?? consolidated?.defaultersCount ?? 0}</div>
          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">Missing students</div>
          <div className="mt-1 text-[10px] font-medium text-indigo-600">Click to view students</div>
        </button>

        <button
          type="button"
          onClick={() => setDrilldownSelection({ category: 'compliant' })}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
          aria-label="View compliant residents"
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase">Institutional Compliance</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{consolidated?.overallComplianceRate || 0}%</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Selected Date: {selectedDate}</div>
          <div className="mt-1 text-[10px] font-medium text-indigo-600">Click to view compliant students</div>
        </button>
      </div>

      {/* Hostel & Block Strategic Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              Hostel Breakdown — Boys Hostel 1 (180), Girls Hostel (165), Boys Hostel 2 (180)
            </h2>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
            <label htmlFor="director-hostel-breakdown-date" className="text-xs text-slate-600 font-medium whitespace-nowrap">
              Select Date:
            </label>
            <input
              id="director-hostel-breakdown-date"
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-white text-slate-900 text-xs font-mono px-2 py-1 rounded border border-slate-300 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
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
                ? 180
                : h.hostelId === 'h-mandakini'
                ? 165
                : 180;
            const hostelMetrics: {
              category: AttendanceDrilldownCategory;
              label: string;
              value: number | string;
              className: string;
            }[] = [
              { category: 'all', label: 'Active Residents:', value: h.totalEnrolled ?? 0, className: 'text-slate-600 bg-white border-slate-100' },
              { category: 'present', label: 'Present:', value: h.present ?? 0, className: 'text-emerald-700 bg-emerald-50/70 border-emerald-100' },
              { category: 'late', label: 'Late Punch:', value: h.late ?? 0, className: 'text-amber-700 bg-amber-50/70 border-amber-100' },
              { category: 'approved_leave', label: 'Approved Leave:', value: h.leave ?? 0, className: 'text-blue-700 bg-blue-50/70 border-blue-100' },
              { category: 'defaulters', label: 'Defaulters:', value: h.defaulters ?? 0, className: 'text-rose-700 bg-rose-50/70 border-rose-100' },
              { category: 'compliant', label: 'Compliance:', value: `${h.complianceRate ?? 0}%`, className: 'text-indigo-700 bg-indigo-50/70 border-indigo-100' }
            ];

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
                  {hostelMetrics.map((metric) => (
                    <button
                      key={metric.category}
                      type="button"
                      onClick={() => setDrilldownSelection({ category: metric.category, hostelId: h.hostelId })}
                      aria-label={`View ${metric.label.replace(':', '')} students for ${h.hostelName}`}
                      className={`flex cursor-pointer items-center justify-between rounded border px-2 py-1 text-left transition hover:border-indigo-300 hover:shadow-xs focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-1 ${metric.className}`}
                    >
                      <span>{metric.label}</span>
                      <strong className="font-bold">{metric.value}</strong>
                    </button>
                  ))}
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
        role={officeRole}
        onDateChange={handleDateChange}
      />

      {/* Institution-Wide Late Punches Roster (Late window: after 7:00 PM through 10:00 PM) */}
      <LatePunchesRoster
        records={latePunches}
        targetDate={selectedDate}
        role={officeRole}
        onDateChange={handleDateChange}
      />

      {/* Automated Strike Records & Disciplinary Warning Tickets */}
      <WarningTicketsTable role={officeRole} />

      {/* Scheduler Execution & Audit Trail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scheduler Job History (FR-06) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>10:00 PM IST Defaulter Evaluation Logs (FR-06)</span>
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

      {drilldownSelection && (
        <DirectorAttendanceDrilldown
          category={drilldownSelection.category}
          hostelId={drilldownSelection.hostelId}
          date={selectedDate}
          onClose={() => setDrilldownSelection(null)}
        />
      )}
    </div>
  );
};
