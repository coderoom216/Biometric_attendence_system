import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  AlertOctagon,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
  FileSpreadsheet,
  Download,
  Calendar
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Student, AttendanceRecord } from '../types';
import { HostelAttendanceBarChart } from '../components/dashboard/HostelAttendanceBarChart';
import { WarningTicketsTable } from '../components/dashboard/WarningTicketsTable';
import { DefaultersRoster } from '../components/dashboard/DefaultersRoster';
import { LatePunchesRoster } from '../components/dashboard/LatePunchesRoster';

type SummaryCategory = 'residents' | 'present' | 'late' | 'leave' | 'follow-up';

export const WardenDashboard: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceDate, setAttendanceDate] = useState('');
  const [dateAttendance, setDateAttendance] = useState<AttendanceRecord[]>([]);
  const [defaulters, setDefaulters] = useState<AttendanceRecord[]>([]);
  const [latePunches, setLatePunches] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<SummaryCategory | null>(null);

  // Determine effective hostel scope
  const effectiveHostelId = user?.hostelId || 'h-mandakini';
  const hostelName = effectiveHostelId === 'h-shivalik'
    ? 'Boys Hostel 1'
    : effectiveHostelId === 'h-nilgiri'
    ? 'BH-2'
    : 'Girls Hostel';

  const hostelStrength = effectiveHostelId === 'h-mandakini' ? 165 : 180;
  const wardenName = effectiveHostelId === 'h-shivalik'
    ? 'Dr. Sati Sir'
    : effectiveHostelId === 'h-nilgiri'
    ? 'Dr. Pathak Sir'
    : 'Dr. Kavita Tariyal';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const attRes = await apiService.getTodayAttendance();
      if (attRes.success) setAttendanceDate((currentDate) => currentDate || attRes.date);

      const stuRes = await apiService.getStudents();
      if (stuRes.success) setStudents(stuRes.students);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (!attendanceDate) return;

    let isCurrentRequest = true;
    setIsSummaryLoading(true);
    setSummaryError(null);

    Promise.all([
      apiService.getAttendanceHistory({ startDate: attendanceDate, endDate: attendanceDate }),
      apiService.getDefaulters(attendanceDate, effectiveHostelId),
      apiService.getLatePunches(attendanceDate, effectiveHostelId)
    ])
      .then(([attendanceRes, defaultersRes, lateRes]) => {
        if (!attendanceRes.success || !defaultersRes.success || !lateRes.success) {
          throw new Error('Unable to load attendance records for this date.');
        }
        if (isCurrentRequest) {
          setDateAttendance(attendanceRes.records);
          setDefaulters(defaultersRes.defaulters);
          setLatePunches(lateRes.latePunches);
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (isCurrentRequest) {
          setDateAttendance([]);
          setDefaulters([]);
          setLatePunches([]);
          setSummaryError('Unable to load attendance records for this date.');
        }
      })
      .finally(() => {
        if (isCurrentRequest) setIsSummaryLoading(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [attendanceDate, effectiveHostelId]);

  const activeResidents = students.filter(
    (student) => student.verificationStatus === 'verified' && student.checkoutStatus === 'active'
  );
  const presentRecords = dateAttendance.filter((record) => record.status === 'present');
  const leaveRecords = dateAttendance.filter((record) => record.status === 'approved_leave');

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollmentNo.toLowerCase().includes(search.toLowerCase()) ||
      s.roomNumber.includes(search)
  );
  const selectedSummaryTitle = selectedSummary
    ? {
        residents: 'Assigned residents',
        present: 'Present records',
        late: 'Late arrival records',
        leave: 'Approved leave records',
        'follow-up': 'Follow-up records'
      }[selectedSummary]
    : '';
  const selectedAttendanceRecords = selectedSummary === 'present'
    ? presentRecords
    : selectedSummary === 'late'
      ? latePunches
      : selectedSummary === 'leave'
        ? leaveRecords
        : selectedSummary === 'follow-up'
          ? defaulters
          : [];

  return (
    <div className="space-y-6">
      {/* Scope Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Hostel Warden Portal</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
              {hostelName} Scope (Strength: {hostelStrength})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Warden: <strong className="text-slate-800">{wardenName}</strong> • Chief Warden: <strong>Prof. Sameer Varma</strong> • 7:00 PM on-time cutoff, late through 10:00 PM, after-10:00 PM defaulter/no-punch evaluation
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="text-right">
            <div className="text-[11px] text-slate-400 font-mono">Cutoff: 19:00 IST</div>
            <div className="text-xs font-bold text-slate-800">Defaulter Escalation Active</div>
          </div>
          <Link
            to="/leaves"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Record approved leave</span>
          </Link>
        </div>
      </div>

      {/* Date-filtered attendance summary */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800">Attendance summary</h2>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-xs">
            <Calendar className="h-4 w-4 text-teal-600" />
            <span>Attendance date</span>
            <input
              type="date"
              value={attendanceDate}
              min="2026-10-22"
              max="2026-10-28"
              onChange={(event) => setAttendanceDate(event.target.value)}
              aria-label="Select attendance summary date"
              className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
            />
          </label>
        </div>

        {summaryError && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {summaryError}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {([
            { key: 'residents', label: 'Assigned Residents', value: activeResidents.length, note: `${hostelName} Blocks A & B`, color: 'text-slate-900' },
            { key: 'present', label: 'Punched Present', value: presentRecords.length, note: 'Before 7:00 PM cutoff', color: 'text-emerald-600' },
            { key: 'late', label: 'Late Grace Punches', value: latePunches.length, note: 'After 7:00 PM through 10:00 PM', color: 'text-amber-600' },
            { key: 'leave', label: 'Approved Leave', value: leaveRecords.length, note: 'Formal Gate Passes', color: 'text-blue-600' },
            { key: 'follow-up', label: 'Needs Follow-up', value: defaulters.length, note: 'After 10:00 PM / no punch', color: 'text-rose-600' }
          ] as const).map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => setSelectedSummary(card.key)}
              aria-label={`View ${card.label.toLowerCase()} records`}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <div className="text-xs font-semibold uppercase text-slate-500">{card.label}</div>
              <div className={`mt-1 text-2xl font-bold ${card.color}`}>
                {card.key !== 'residents' && isSummaryLoading ? '…' : card.value}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{card.note}</div>
              <div className="mt-2 text-[10px] font-semibold text-teal-700">Click to see records</div>
            </button>
          ))}
        </div>
      </div>

      {/* Date-Wise Longitudinal Attendance Bar Chart */}
      <HostelAttendanceBarChart
        currentDate={attendanceDate || '2026-10-27'}
        hostelId={effectiveHostelId}
        allowHostelSwitch={false}
        onDateChange={setAttendanceDate}
      />

      {/* Automated Strike Records & Disciplinary Warning Tickets */}
      <WarningTicketsTable hostelId={effectiveHostelId} role="warden" />

      {/* Post-Grace Cutoff Defaulters Roster */}
      <DefaultersRoster
        records={defaulters}
        targetDate={attendanceDate || '2026-10-27'}
        title={`Post-Grace Cutoff Defaulters (${hostelName})`}
        role="warden"
        hostelId={effectiveHostelId}
      />

      {/* Late Punches Roster (Late window: after 7:00 PM through 10:00 PM) */}
      <LatePunchesRoster
        records={latePunches}
        targetDate={attendanceDate || '2026-10-27'}
        title={`Late Grace Punches (${hostelName})`}
        role="warden"
        hostelId={effectiveHostelId}
      />

      {selectedSummary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedSummary(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="warden-summary-records-title"
            className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <h2 id="warden-summary-records-title" className="text-sm font-bold text-slate-900">{selectedSummaryTitle}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedSummary === 'residents' ? `${hostelName} active residents` : `Attendance date: ${attendanceDate}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSummary(null)}
                aria-label="Close records"
                className="rounded px-2 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            {selectedSummary !== 'residents' && isSummaryLoading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading records…</div>
            ) : selectedSummary !== 'residents' && summaryError ? (
              <div role="alert" className="p-8 text-center text-sm text-rose-700">{summaryError}</div>
            ) : selectedSummary === 'residents' ? (
              activeResidents.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No active residents found.</div>
              ) : (
                <div className="max-h-[65vh] overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Enrollment No</th>
                        <th className="px-4 py-3">Block / Room</th>
                        <th className="px-4 py-3">Course</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeResidents.map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{student.name}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{student.enrollmentNo}</td>
                          <td className="px-4 py-3 text-slate-700">{student.block}, Room {student.roomNumber}</td>
                          <td className="px-4 py-3 text-slate-700">{student.course}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : selectedAttendanceRecords.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No records found for this category and date.</div>
            ) : (
              <div className="max-h-[65vh] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Enrollment No</th>
                      <th className="px-4 py-3">Block / Room</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Punch time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedAttendanceRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{record.studentName}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{record.enrollmentNo}</td>
                        <td className="px-4 py-3 text-slate-700">{record.block}, Room {record.roomNumber}</td>
                        <td className="px-4 py-3 capitalize text-slate-700">{record.status.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-slate-700">{record.punchTime || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Student Roster Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
            <Users className="w-4 h-4 text-teal-600" />
            <span>Assigned Students ({hostelName})</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by student or room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-60 focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Enrollment No</th>
                <th className="py-2.5 px-3">Block / Room</th>
                <th className="py-2.5 px-3">Course</th>
                <th className="py-2.5 px-3">Biometric ID</th>
                <th className="py-2.5 px-3">Parent Contact</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{s.name}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{s.enrollmentNo}</td>
                  <td className="py-2.5 px-3 text-slate-700">{s.block}, Room {s.roomNumber}</td>
                  <td className="py-2.5 px-3 text-slate-600">{s.course}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{s.biometricId}</td>
                  <td className="py-2.5 px-3 text-slate-600">{s.parentEmail || <span className="text-rose-500 font-semibold">Missing</span>}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      {s.verificationStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
