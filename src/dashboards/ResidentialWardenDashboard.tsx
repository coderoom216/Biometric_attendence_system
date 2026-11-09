import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertOctagon,
  FileText,
  UserCheck,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Clock,
  ShieldCheck,
  Search,
  Building2,
  Edit3
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Student, AttendanceRecord, LeaveRecord } from '../types';
import { HostelAttendanceBarChart } from '../components/dashboard/HostelAttendanceBarChart';
import { WarningTicketsTable } from '../components/dashboard/WarningTicketsTable';

export const ResidentialWardenDashboard: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [defaulters, setDefaulters] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [isPastCutoff, setIsPastCutoff] = useState(true);
  const [isPastDefaulter, setIsPastDefaulter] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Leave Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    studentId: '',
    startDate: '2026-10-27',
    endDate: '2026-10-29',
    reason: '',
    gatePassNo: `GP-${Date.now().toString().slice(-4)}`,
    parentConsentVerified: true,
    notes: ''
  });
  const [leaveSubmitMsg, setLeaveSubmitMsg] = useState<string | null>(null);

  // Correction Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRecord | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<string>('present');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [correctionMsg, setCorrectionMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const attRes = await apiService.getTodayAttendance();
      if (attRes.success) {
        setTodayAttendance(attRes.records);
        setIsPastCutoff(attRes.isPastCutoff);
        setIsPastDefaulter(attRes.isPastDefaulterTime);
      }

      const defRes = await apiService.getDefaulters();
      if (defRes.success) {
        setDefaulters(defRes.defaulters);
      }

      const stuRes = await apiService.getStudents();
      if (stuRes.success) {
        setStudents(stuRes.students);
      }

      const leaveRes = await apiService.getLeaves();
      if (leaveRes.success) {
        setLeaves(leaveRes.leaves);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle Leave Submission (FR-11)
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveSubmitMsg(null);
    try {
      const res = await apiService.enterLeave(leaveForm);
      if (res.success) {
        setLeaveSubmitMsg('Leave successfully entered and verified. Automated absence alerts suppressed.');
        setTimeout(() => {
          setIsLeaveModalOpen(false);
          setLeaveSubmitMsg(null);
          loadData();
        }, 1200);
      }
    } catch (err: any) {
      setLeaveSubmitMsg(err.response?.data?.message || 'Error logging leave');
    }
  };

  // Handle Registration Verification (FR-02)
  const handleVerifyStudent = async (studentId: string, action: 'approve' | 'reject') => {
    try {
      const res = await apiService.verifyStudentRegistration(studentId, action);
      if (res.success) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Attendance Correction (FR-11)
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTarget) return;
    try {
      const res = await apiService.correctAttendance(
        correctionTarget.id,
        correctionStatus,
        correctionReason
      );
      if (res.success) {
        setCorrectionMsg('Attendance corrected and audit log recorded.');
        setTimeout(() => {
          setIsCorrectionModalOpen(false);
          setCorrectionMsg(null);
          loadData();
        }, 1000);
      }
    } catch (err: any) {
      setCorrectionMsg(err.response?.data?.message || 'Correction failed');
    }
  };

  const pendingStudents = students.filter((s) => s.verificationStatus === 'pending_verification');
  const presentCount = todayAttendance.filter((a) => a.status === 'present').length;
  const lateCount = todayAttendance.filter((a) => a.status === 'late').length;
  const onLeaveCount = todayAttendance.filter((a) => a.status === 'approved_leave').length;
  const activeResidents = students.filter((s) => s.verificationStatus === 'verified' && s.checkoutStatus === 'active');

  return (
    <div className="space-y-6">
      {/* Scope Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Hostel overview</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Boys Hostel 1 · 120 residents
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage attendance, registration reviews, and approved leave for your hostel.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <button
          onClick={() => setIsLeaveModalOpen(true)}
          className="flex items-center space-x-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Record approved leave</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Residents</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{activeResidents.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Boys Hostel 1 (Blocks A & B)</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Present today</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{presentCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">By 7:00 PM IST</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Late arrivals</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{lateCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">7:00 PM - 9:00 PM IST</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">On approved leave</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{onLeaveCount}</div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">No absence alerts during leave</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Needs follow-up</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{defaulters.length}</div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">Follow-up notifications sent</div>
        </div>
      </div>

      {/* Date-Wise Longitudinal Attendance Bar Chart */}
      <HostelAttendanceBarChart
        currentDate="2026-10-27"
        hostelId={user?.hostelId || 'h-shivalik'}
        allowHostelSwitch={false}
      />

      {/* Automated Strike Records & Disciplinary Warning Tickets */}
      <WarningTicketsTable hostelId={user?.hostelId || 'h-shivalik'} role="residential_warden" />

      {/* Real-time 9:00 PM IST Defaulters Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 bg-rose-50/60 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-rose-600" />
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Students to follow up
              </h2>
              <p className="text-[11px] text-rose-700">
                These residents have not checked in after the evening cutoff. Review each record and follow up as needed.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-rose-600 text-white px-2.5 py-1 rounded-md">
            {defaulters.length} students
          </span>
        </div>

        {defaulters.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Everyone is accounted for or has approved leave today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Enrollment No</th>
                  <th className="py-3 px-4">Block / Room</th>
                  <th className="py-3 px-4">Cutoff Status</th>
                  <th className="py-3 px-4">Email Escalation</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {defaulters.map((d) => (
                  <tr key={d.id} className="hover:bg-rose-50/30 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">{d.studentName}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{d.enrollmentNo}</td>
                    <td className="py-3 px-4 text-slate-700">{d.block}, Room {d.roomNumber}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Not checked in
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[11px] text-slate-600">
                        <span className="text-emerald-700 font-semibold">Team notified</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setCorrectionTarget(d);
                          setCorrectionStatus('present');
                          setCorrectionReason('');
                          setIsCorrectionModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Update attendance</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Registration Verification Queue (FR-02) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              Registration requests
            </h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {pendingStudents.length} awaiting review
          </span>
        </div>

        {pendingStudents.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-xs">
            No registration requests need review right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Enrollment No</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Parent Email</th>
                  <th className="py-2.5 px-3 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{s.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{s.enrollmentNo}</td>
                    <td className="py-2.5 px-3 text-slate-600">{s.course}</td>
                    <td className="py-2.5 px-3 text-slate-600">{s.block}, Room {s.roomNumber}</td>
                    <td className="py-2.5 px-3 text-slate-600">{s.parentEmail}</td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        onClick={() => handleVerifyStudent(s.id, 'approve')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition"
                      >
                        Approve & Verify
                      </button>
                      <button
                        onClick={() => handleVerifyStudent(s.id, 'reject')}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-semibold transition"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enter Approved Leave Modal (FR-11) */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-sm">Enter Approved Leave (Residential Warden Only)</h3>
              </div>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-blue-900 text-[11px] leading-relaxed">
                <strong>Before you save:</strong> Leave is recorded by the warden. Confirm the dates and parent or guardian consent; approved leave prevents absence alerts during that period.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
                  Select Student
                </label>
                <select
                  required
                  value={leaveForm.studentId}
                  onChange={(e) => setLeaveForm({ ...leaveForm, studentId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Resident --</option>
                  {activeResidents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.enrollmentNo}) - {s.block}, Room {s.roomNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
                  Gate Pass Number
                </label>
                <input
                  type="text"
                  required
                  value={leaveForm.gatePassNo}
                  onChange={(e) => setLeaveForm({ ...leaveForm, gatePassNo: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
                  Reason for leave
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sibling Wedding in Jaipur with formal written letter"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="consent"
                  checked={leaveForm.parentConsentVerified}
                  onChange={(e) => setLeaveForm({ ...leaveForm, parentConsentVerified: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <label htmlFor="consent" className="text-slate-700 font-medium text-xs">
                  I confirmed consent with the student's parent or guardian.
                </label>
              </div>

              {leaveSubmitMsg && (
                <div className={`p-2.5 rounded-lg text-xs ${leaveSubmitMsg.includes('success') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {leaveSubmitMsg}
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
                >
                  Save approved leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Correction Modal */}
      {isCorrectionModalOpen && correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Update attendance</h3>
              <button onClick={() => setIsCorrectionModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCorrectionSubmit} className="p-5 space-y-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border text-slate-700">
                <div><strong>Student:</strong> {correctionTarget.studentName} ({correctionTarget.enrollmentNo})</div>
                <div><strong>Current status:</strong> {correctionTarget.status}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Attendance Status</label>
                <select
                  value={correctionStatus}
                  onChange={(e) => setCorrectionStatus(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="present">Present (Punched / Verified at Gate)</option>
                  <option value="late">Late (Valid delay authorization)</option>
                  <option value="approved_leave">Approved Leave</option>
                  <option value="absent">Absent / Defaulter</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for this update</label>
                <textarea
                  required
                  rows={2}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="Add a short note explaining the change..."
                />
              </div>

              {correctionMsg && (
                <div className="p-2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {correctionMsg}
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                >
                  Apply Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
