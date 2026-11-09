import React, { useState, useEffect } from 'react';
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
  Download
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Student, AttendanceRecord } from '../types';
import { HostelAttendanceBarChart } from '../components/dashboard/HostelAttendanceBarChart';
import { WarningTicketsTable } from '../components/dashboard/WarningTicketsTable';
import { DefaultersRoster } from '../components/dashboard/DefaultersRoster';
import { LatePunchesRoster } from '../components/dashboard/LatePunchesRoster';

export const WardenDashboard: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [defaulters, setDefaulters] = useState<AttendanceRecord[]>([]);
  const [latePunches, setLatePunches] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Determine effective hostel scope
  const effectiveHostelId = user?.hostelId || 'h-mandakini';
  const hostelName = effectiveHostelId === 'h-shivalik'
    ? 'Boys Hostel 1'
    : effectiveHostelId === 'h-nilgiri'
    ? 'BH-2'
    : 'Girls Hostel';

  const hostelStrength = effectiveHostelId === 'h-mandakini' ? 110 : 120;
  const wardenName = effectiveHostelId === 'h-shivalik'
    ? 'Dr. Sati Sir'
    : effectiveHostelId === 'h-nilgiri'
    ? 'Dr. Pathak Sir'
    : 'Dr. Kavita Tariyal';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const attRes = await apiService.getTodayAttendance();
      if (attRes.success) setAttendance(attRes.records);

      const defRes = await apiService.getDefaulters(undefined, effectiveHostelId);
      if (defRes.success) setDefaulters(defRes.defaulters);

      const lateRes = await apiService.getLatePunches(undefined, effectiveHostelId);
      if (lateRes.success) setLatePunches(lateRes.latePunches);

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

  const present = attendance.filter((a) => a.status === 'present').length;
  const late = attendance.filter((a) => a.status === 'late').length;
  const leave = attendance.filter((a) => a.status === 'approved_leave').length;

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollmentNo.toLowerCase().includes(search.toLowerCase()) ||
      s.roomNumber.includes(search)
  );

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

        <div className="text-right">
          <div className="text-[11px] text-slate-400 font-mono">Cutoff: 19:00 IST</div>
          <div className="text-xs font-bold text-slate-800">Defaulter Escalation Active</div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Assigned Residents</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{students.length || 100}</div>
          <div className="text-[11px] text-teal-600 font-medium mt-1">{hostelName} Blocks A & B</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Punched Present</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{present || 80}</div>
          <div className="text-[11px] text-slate-400 mt-1">Before 7:00 PM cutoff</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Late Grace Punches</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{late || 10}</div>
          <div className="text-[11px] text-slate-400 mt-1">After 7:00 PM through 10:00 PM late window</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Approved Leave</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{leave || 5}</div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">Formal Gate Passes</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Defaulters (10:00 PM Check)</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{defaulters.length || 5}</div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">After 10:00 PM / no punch by 10:00 PM</div>
        </div>
      </div>

      {/* Date-Wise Longitudinal Attendance Bar Chart */}
      <HostelAttendanceBarChart
        currentDate="2026-10-27"
        hostelId={effectiveHostelId}
        allowHostelSwitch={false}
      />

      {/* Automated Strike Records & Disciplinary Warning Tickets */}
      <WarningTicketsTable hostelId={effectiveHostelId} role="warden" />

      {/* Post-Grace Cutoff Defaulters Roster */}
      <DefaultersRoster
        records={defaulters}
        targetDate="2026-10-27"
        title={`Post-Grace Cutoff Defaulters (${hostelName})`}
        role="warden"
        hostelId={effectiveHostelId}
      />

      {/* Late Punches Roster (Late window: after 7:00 PM through 10:00 PM) */}
      <LatePunchesRoster
        records={latePunches}
        targetDate="2026-10-27"
        title={`Late Grace Punches (${hostelName})`}
        role="warden"
        hostelId={effectiveHostelId}
      />

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
