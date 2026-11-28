import React, { useState, useEffect } from 'react';
import {
  FileText,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Search,
  Building2,
  Calendar,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { InstitutionalHoliday, LeaveRecord, Student } from '../types';
import { EditLeaveModal } from '../components/dashboard/EditLeaveModal';
import { LeaveDecisionConfirmModal } from '../components/dashboard/LeaveDecisionConfirmModal';
import { StudentLeaveApplicationSection } from '../components/dashboard/StudentLeaveApplicationSection';

export const LeaveManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [leaveForm, setLeaveForm] = useState({
    studentId: '',
    startDate: todayIst,
    endDate: todayIst,
    reason: '',
    gatePassNo: `GP-${Date.now().toString().slice(-4)}`,
    parentConsentVerified: true,
    notes: ''
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [updatingLeaveId, setUpdatingLeaveId] = useState<string | null>(null);
  const [editingLeave, setEditingLeave] = useState<LeaveRecord | null>(null);
  const [confirmDecision, setConfirmDecision] = useState<{ leave: LeaveRecord; action: 'approved' | 'rejected' } | null>(null);

  // Student view state
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);

  // Chief Warden holiday calendar state
  const [holidays, setHolidays] = useState<InstitutionalHoliday[]>([]);
  const [holidayStartDate, setHolidayStartDate] = useState('');
  const [holidayEndDate, setHolidayEndDate] = useState('');
  const [holidayReason, setHolidayReason] = useState('');
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [holidayFeedback, setHolidayFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isStudent = user?.role === 'student';
  const isChiefWarden = user?.role === 'chief_warden' || String(user?.role) === 'admin';
  const isCaretaker = user?.role === 'caretaker';
  const canEnterLeave = ['residential_warden', 'warden', 'chief_warden', 'director', 'admin', 'caretaker'].includes(user?.role || '');
  const canApproveLeave = ['residential_warden', 'warden', 'chief_warden', 'director', 'admin'].includes(user?.role || '');

  const loadData = async () => {
    try {
      if (isStudent) {
        const [stuRes, myLeavesRes] = await Promise.allSettled([
          user?.studentId ? apiService.getStudentById(user.studentId) : Promise.resolve(null),
          apiService.getMyLeaves(),
        ]);
        if (stuRes.status === 'fulfilled' && stuRes.value?.success) {
          setStudentProfile(stuRes.value.student);
        }
        if (myLeavesRes.status === 'fulfilled' && Array.isArray(myLeavesRes.value?.leaves)) {
          setLeaves(myLeavesRes.value.leaves);
        }
        return;
      }

      const lRes = await apiService.getLeaves();
      if (lRes.success) setLeaves(lRes.leaves);

      if (canEnterLeave) {
        const sRes = await apiService.getStudents();
        if (sRes.success) {
          setStudents(sRes.students.filter(
            (s) => s.verificationStatus === 'verified' && s.checkoutStatus === 'active'
          ));
        }
      }

      if (isChiefWarden) {
        const hRes = await apiService.getHolidays();
        if (hRes.success) setHolidays(hRes.holidays || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setHolidayFeedback(null);

    if (!holidayStartDate) {
      setHolidayFeedback({ type: 'error', text: 'Please select a holiday start date.' });
      return;
    }
    const effectiveEnd = holidayEndDate || holidayStartDate;
    if (effectiveEnd < holidayStartDate) {
      setHolidayFeedback({ type: 'error', text: 'Holiday end date cannot be earlier than start date.' });
      return;
    }
    if (holidayReason.trim().length < 2) {
      setHolidayFeedback({ type: 'error', text: 'Please enter the reason for this day off.' });
      return;
    }

    setIsSavingHoliday(true);
    try {
      const res = await apiService.createHoliday({
        startDate: holidayStartDate,
        endDate: effectiveEnd,
        reason: holidayReason.trim(),
      });
      if (res.success) {
        setHolidayStartDate('');
        setHolidayEndDate('');
        setHolidayReason('');
        setHolidayFeedback({ type: 'success', text: res.message || 'Institutional holiday added successfully.' });
        await loadData();
      }
    } catch (err: any) {
      setHolidayFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Unable to schedule institutional holiday.',
      });
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    setHolidayFeedback(null);
    try {
      const res = await apiService.deleteHoliday(holidayId);
      if (res.success) {
        setHolidayFeedback({ type: 'success', text: res.message || 'Institutional holiday removed.' });
        await loadData();
      }
    } catch (err: any) {
      setHolidayFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Unable to remove holiday.',
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!leaveForm.studentId) {
      setFeedback('Search for and select a resident student before saving.');
      return;
    }

    try {
      const res = await apiService.enterLeave(leaveForm);
      if (res.success) {
        setFeedback('Leave successfully logged. Automated absence notifications are now suppressed for these dates.');
        setTimeout(() => {
          setIsLeaveModalOpen(false);
          setStudentSearch('');
          setLeaveForm((form) => ({ ...form, studentId: '', reason: '' }));
          setFeedback(null);
          loadData();
        }, 1200);
      }
    } catch (err: any) {
      setFeedback(err.response?.data?.message || 'Error entering leave');
    }
  };

  const handleLeaveStatusUpdate = async (leaveId: string, status: 'approved' | 'rejected') => {
    setActionFeedback(null);
    setUpdatingLeaveId(leaveId);
    try {
      const res = await apiService.updateLeaveStatus(leaveId, status);
      await loadData();
      setActionFeedback({
        type: 'success',
        message: res?.message || (status === 'approved' ? 'Leave approved and attendance updated.' : 'Leave request rejected.'),
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Unable to update leave status.',
      });
    } finally {
      setUpdatingLeaveId(null);
    }
  };

  const matchingStudents = students.filter((student) => {
    const query = studentSearch.trim().toLowerCase();
    return !query || [
      student.name,
      student.enrollmentNo,
      student.block,
      student.roomNumber
    ].some((value) => value.toLowerCase().includes(query));
  });

  const filteredLeaves = leaves.filter(
    (l) =>
      l.studentName.toLowerCase().includes(search.toLowerCase()) ||
      l.enrollmentNo.toLowerCase().includes(search.toLowerCase()) ||
      l.gatePassNo.toLowerCase().includes(search.toLowerCase())
  );

  if (isStudent) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">My Approved Leaves &amp; Applications</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Warden Approval Workflow
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Submit leave applications directly to your Residential Warden and track approval status in real time.
          </p>
        </div>

        <StudentLeaveApplicationSection
          profile={studentProfile}
          studentName={user?.name || 'Student'}
          leaves={leaves}
          onSubmitted={loadData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Approved Leave Management (FR-11)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Absence Email Suppression Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Formal leave logging by an authorized warden upon verification of the application and parent consent.
          </p>
        </div>

        {canEnterLeave && (
          <button
            onClick={() => {
              setLeaveForm((form) => ({ ...form, studentId: '' }));
              setStudentSearch('');
              setFeedback(null);
              setIsStudentDropdownOpen(false);
              setIsLeaveModalOpen(true);
            }}
            className="flex items-center space-x-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isCaretaker ? 'Assign Leave (Pending Warden Approval)' : 'Enter Approved Leave'}</span>
          </button>
        )}
      </div>

      {/* Mandatory Institutional Rule Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="font-bold">Leave approval procedure:</div>
          <p className="leading-relaxed text-[11px] text-blue-800">
            Students cannot directly approve leave in the system. An authorized warden reviews and approves submitted applications. Once approved, automated absence emails are suppressed for the approved dates.
          </p>
        </div>
      </div>

      {/* Chief Warden Institutional Holiday Calendar */}
      {isChiefWarden && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Institutional Holiday Calendar</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official holidays apply to every active student across all hostels. Attendance is not required and no absence defaulters are created.
              </p>
            </div>
          </div>

          <form onSubmit={handleMarkHoliday} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="holiday-start-date" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Date
                </label>
                <input
                  id="holiday-start-date"
                  type="date"
                  required
                  value={holidayStartDate}
                  onChange={(e) => {
                    setHolidayStartDate(e.target.value);
                    if (!holidayEndDate || holidayEndDate < e.target.value) {
                      setHolidayEndDate(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="holiday-end-date" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  End Date
                </label>
                <input
                  id="holiday-end-date"
                  type="date"
                  min={holidayStartDate || undefined}
                  value={holidayEndDate}
                  onChange={(e) => setHolidayEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label htmlFor="holiday-reason" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Reason
                </label>
                <input
                  id="holiday-reason"
                  type="text"
                  required
                  placeholder="Enter the reason for this day off"
                  value={holidayReason}
                  onChange={(e) => setHolidayReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingHoliday}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isSavingHoliday ? 'Saving...' : 'Mark Holiday'}
              </button>
            </div>
          </form>

          {holidayFeedback && (
            <div
              role={holidayFeedback.type === 'error' ? 'alert' : 'status'}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                holidayFeedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {holidayFeedback.text}
            </div>
          )}

          {holidays.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
              No current or upcoming holiday dates are listed. Choose a start date, end date, and reason above to add one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Date Range</th>
                    <th className="py-2 px-3">Days</th>
                    <th className="py-2 px-3">Reason</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidays.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                        {h.startDate === h.endDate ? h.startDate : `${h.startDate} to ${h.endDate}`}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{h.durationDays}</td>
                      <td className="py-2 px-3 text-slate-700">{h.reason}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          h.isPast ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {h.isPast ? 'Past' : 'Upcoming'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteHoliday(h.id)}
                          aria-label={`Remove holiday ${h.reason}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {actionFeedback && (
        <div
          role={actionFeedback.type === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            actionFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {actionFeedback.message}
        </div>
      )}

      {/* Leave Records Search & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Official Approved Leaves Register</span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by student, gate pass..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Gate Pass No</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Hostel / Room</th>
                <th className="py-2.5 px-3">Approved Duration</th>
                <th className="py-2.5 px-3">Reason / Details</th>
                <th className="py-2.5 px-3">Parent Consent</th>
                <th className="py-2.5 px-3">Authorized By</th>
                <th className="py-2.5 px-3">Approval Status</th>
                {canApproveLeave && <th className="py-2.5 px-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={canApproveLeave ? 9 : 8} className="py-8 text-center text-slate-400">
                    No approved leaves found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{l.gatePassNo}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{l.studentName}</div>
                      <div className="font-mono text-[10px] text-slate-500">{l.enrollmentNo}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{l.hostel || l.block || 'Hostel'}, Room {l.roomNumber || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">
                      {l.startDate} to {l.endDate}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs">{l.reason}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-emerald-700 font-semibold flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Phone Verified
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{l.approvedBy || l.residentialWardenName || 'Pending Warden'}</td>
                    <td className="py-2.5 px-3">
                      {(() => {
                        const isPending = l.status === 'Pending' || l.approvalStatus === 'pending';
                        const isRejected = l.status === 'Rejected' || l.approvalStatus === 'rejected';
                        const badgeClass = isPending
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : isRejected
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        const label = isPending
                          ? 'Pending Warden Approval'
                          : isRejected
                            ? 'Rejected'
                            : 'Approved';
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    {canApproveLeave && (
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          {(l.status === 'Pending' || l.approvalStatus === 'pending') && (
                            <>
                              <button
                                type="button"
                                disabled={updatingLeaveId === l.id}
                                onClick={() => setConfirmDecision({ leave: l, action: 'approved' })}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={updatingLeaveId === l.id}
                                onClick={() => setConfirmDecision({ leave: l, action: 'rejected' })}
                                className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingLeave(l)}
                            className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-semibold cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enter Leave Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 id="leave-modal-title" className="font-semibold text-sm">Enter Approved Leave</h3>
              <button
                type="button"
                aria-label="Close leave form"
                onClick={() => {
                  setIsLeaveModalOpen(false);
                  setIsStudentDropdownOpen(false);
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} aria-labelledby="leave-modal-title" className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                  Select Resident Student
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    role="combobox"
                    aria-label="Search resident students"
                    aria-autocomplete="list"
                    aria-expanded={isStudentDropdownOpen}
                    aria-controls="leave-student-options"
                    aria-required="true"
                    autoComplete="off"
                    placeholder="Search by name, enrollment, block, or room..."
                    value={studentSearch}
                    onFocus={() => setIsStudentDropdownOpen(true)}
                    onChange={(event) => {
                      setStudentSearch(event.target.value);
                      setLeaveForm((form) => ({ ...form, studentId: '' }));
                      setIsStudentDropdownOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setIsStudentDropdownOpen(false);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-200"
                  />
                  {isStudentDropdownOpen && (
                    <ul
                      id="leave-student-options"
                      role="listbox"
                      className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                    >
                      {matchingStudents.length ? matchingStudents.map((student) => (
                        <li key={student.id} role="option" aria-selected={leaveForm.studentId === student.id}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setLeaveForm((form) => ({ ...form, studentId: student.id }));
                              setStudentSearch(`${student.name} (${student.enrollmentNo})`);
                              setIsStudentDropdownOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-hidden"
                          >
                            <span className="block font-semibold text-slate-800">{student.name}</span>
                            <span className="mt-0.5 block text-[11px] text-slate-500">
                              {student.enrollmentNo} · {student.block}, Room {student.roomNumber}
                            </span>
                          </button>
                        </li>
                      )) : (
                        <li className="px-3 py-2 text-slate-500">No matching active students.</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Gate Pass Number</label>
                <input
                  type="text"
                  required
                  value={leaveForm.gatePassNo}
                  onChange={(e) => setLeaveForm({ ...leaveForm, gatePassNo: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Formal Reason / Purpose</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sibling Wedding with written letter"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="consent_check"
                  checked={leaveForm.parentConsentVerified}
                  onChange={(e) => setLeaveForm({ ...leaveForm, parentConsentVerified: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="consent_check" className="text-slate-700 font-medium text-xs">
                  I confirm that parent consent was verbally/physically verified.
                </label>
              </div>

              {feedback && (
                <div className={`p-2.5 rounded-lg text-xs ${feedback.includes('successfully') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {feedback}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                >
                  Save & Suppress Absence Emails
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <EditLeaveModal
        leave={editingLeave}
        onClose={() => setEditingLeave(null)}
        onSaved={async (_updated, message) => {
          setEditingLeave(null);
          await loadData();
          setActionFeedback({ type: 'success', message });
        }}
      />

      <LeaveDecisionConfirmModal
        leave={confirmDecision?.leave || null}
        action={confirmDecision?.action || null}
        isSubmitting={Boolean(confirmDecision && updatingLeaveId === confirmDecision.leave.id)}
        onCancel={() => setConfirmDecision(null)}
        onConfirm={async () => {
          if (!confirmDecision) return;
          const { leave, action } = confirmDecision;
          await handleLeaveStatusUpdate(leave.id, action);
          setConfirmDecision(null);
        }}
      />
    </div>
  );
};
