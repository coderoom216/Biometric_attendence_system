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
  CalendarDays,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { HolidayRecord, LeaveApplication, LeaveRecord, Student } from '../types';

const LOCAL_HOLIDAYS_KEY = 'hostel_local_holiday_periods';

const readLocalHolidays = (): HolidayRecord[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_HOLIDAYS_KEY) || '[]') as HolidayRecord[];
  } catch {
    return [];
  }
};

const getLocalDateString = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const getHostelLabel = (hostelId?: string) => ({
  'h-shivalik': 'BH1',
  'h-mandakini': 'GH',
  'h-nilgiri': 'BH2'
}[hostelId || ''] || hostelId || 'your hostel');

export const LeaveManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);
  const [studentApplicationForm, setStudentApplicationForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>(readLocalHolidays);
  const [todayDate, setTodayDate] = useState(getLocalDateString);
  const [holidayStartDate, setHolidayStartDate] = useState('');
  const [holidayEndDate, setHolidayEndDate] = useState('');
  const [holidayReason, setHolidayReason] = useState('');
  const [search, setSearch] = useState('');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    studentId: '',
    startDate: '2026-10-27',
    endDate: '2026-10-29',
    reason: '',
    gatePassNo: `GP-${Date.now().toString().slice(-4)}`,
    parentConsentVerified: true,
    notes: ''
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  const canEnterLeave = ['residential_warden', 'warden', 'chief_warden', 'director'].includes(user?.role || '');
  const isChiefWarden = user?.role === 'chief_warden';
  const isResidentialWarden = user?.role === 'residential_warden' || user?.role === 'warden';
  const isStudent = user?.role === 'student';
  const visibleHolidays = holidays.filter((holiday) => holiday.endDate >= todayDate);

  useEffect(() => {
    const refreshToday = () => setTodayDate(getLocalDateString());
    const intervalId = window.setInterval(refreshToday, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const loadData = async () => {
    try {
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
      if (isResidentialWarden || isStudent) {
        const applicationsRes = await apiService.getLeaveApplications();
        if (applicationsRes.success) setLeaveApplications(applicationsRes.applications);
      }
      if (isStudent && user?.studentId) {
        const profileRes = await apiService.getStudentById(user.studentId);
        if (profileRes.success) setStudentProfile(profileRes.student);
      }
      if (isChiefWarden) {
        const hRes = await apiService.getHolidays();
        if (hRes.success) {
          const localHolidays = readLocalHolidays();
          const syncedRanges = new Set(hRes.holidays.map((holiday) => `${holiday.startDate}|${holiday.endDate}|${holiday.reason}`));
          const pendingLocal = localHolidays.filter((holiday) => !syncedRanges.has(`${holiday.startDate}|${holiday.endDate}|${holiday.reason}`));
          setHolidays([...hRes.holidays, ...pendingLocal].sort((a, b) => a.startDate.localeCompare(b.startDate)));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const reviewApplication = async (applicationId: string, decision: 'approved' | 'denied') => {
    setReviewingApplicationId(applicationId);
    setFeedback(null);
    try {
      const result = await apiService.reviewLeaveApplication(applicationId, decision);
      setFeedback(result.message);
      await loadData();
    } catch (err: any) {
      setFeedback(err.response?.data?.message || 'Unable to review this leave application.');
    } finally {
      setReviewingApplicationId(null);
    }
  };

  const submitStudentApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    setIsSubmittingApplication(true);
    try {
      const result = await apiService.submitLeaveApplication(studentApplicationForm);
      setLeaveApplications((current) => [result.application, ...current]);
      setStudentApplicationForm({ startDate: '', endDate: '', reason: '' });
      setFeedback(result.message);
    } catch (err: any) {
      const serverMessage = err.response?.data?.message;
      const connectionMessage = !err.response
        ? 'The application server could not be reached. Refresh the page and try again.'
        : null;
      setFeedback(serverMessage || connectionMessage || err.message || 'Unable to submit your leave application. Please try again.');
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  const refreshStudentApplications = async () => {
    try {
      const [applicationsRes, leavesRes] = await Promise.all([apiService.getLeaveApplications(), apiService.getLeaves()]);
      if (applicationsRes.success) setLeaveApplications(applicationsRes.applications);
      if (leavesRes.success) setLeaves(leavesRes.leaves);
    } catch (err) {
      console.error('Unable to refresh leave application status:', err);
    }
  };

  const saveHoliday = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    try {
      const result = await apiService.addHoliday(holidayStartDate, holidayEndDate, holidayReason);
      setFeedback(result.message);
      setHolidays((current) => [...current.filter((holiday) => holiday.id !== result.holiday.id), result.holiday].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setHolidayStartDate('');
      setHolidayEndDate('');
      setHolidayReason('');
      await loadData();
    } catch (err: any) {
      const localHoliday: HolidayRecord = {
        id: `local-holiday-${Date.now()}`,
        startDate: holidayStartDate,
        endDate: holidayEndDate,
        reason: holidayReason.trim(),
        createdBy: user?.name || 'Chief Warden',
        createdAt: new Date().toISOString()
      };
      const nextLocalHolidays = [...readLocalHolidays(), localHoliday];
      localStorage.setItem(LOCAL_HOLIDAYS_KEY, JSON.stringify(nextLocalHolidays));
      setHolidays((current) => [...current, localHoliday].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      const serverMessage = err.response?.data?.message;
      setFeedback(serverMessage
        ? `Shown in this browser’s list, but the server did not save it: ${serverMessage}`
        : 'Holiday added to this browser’s list. Server connection is unavailable, so it has not been applied across the system yet.');
      setHolidayStartDate('');
      setHolidayEndDate('');
      setHolidayReason('');
    }
  };

  const deleteHoliday = async (date: string) => {
    const targetHoliday = holidays.find((holiday) => holiday.id === date);
    if (date.startsWith('local-holiday-')) {
      const nextLocalHolidays = readLocalHolidays().filter((holiday) => holiday.id !== date);
      localStorage.setItem(LOCAL_HOLIDAYS_KEY, JSON.stringify(nextLocalHolidays));
      setHolidays((current) => current.filter((holiday) => holiday.id !== date));
      setFeedback('Holiday removed from this browser’s list.');
      return;
    }
    try {
      await apiService.removeHoliday(date);
      await loadData();
      setFeedback('Holiday removed.');
    } catch (err: any) {
      if (!err.response && targetHoliday) {
        const nextLocalHolidays = [...readLocalHolidays(), { ...targetHoliday, id: `local-holiday-${Date.now()}` }];
        localStorage.setItem(LOCAL_HOLIDAYS_KEY, JSON.stringify(nextLocalHolidays));
        setHolidays((current) => current.filter((holiday) => holiday.id !== date));
        setFeedback('Holiday removed from this browser’s list. Server connection is unavailable.');
      } else {
        setFeedback(err.response?.data?.message || 'Unable to remove this holiday.');
      }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">{isStudent ? 'My Approved Leaves' : 'Leave & Correction Audits'}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Absence Email Suppression Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isStudent ? 'Apply for leave and follow your Residential Warden’s decision.' : 'Formal leave logging by an authorized warden upon verification of the application and parent consent.'}
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
            <span>Enter Approved Leave</span>
          </button>
        )}
      </div>

      {isStudent && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <form onSubmit={submitStudentApplication} className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Apply for Leave</h2>
              <p className="mt-1 text-[11px] text-slate-600">Your application goes to the Residential Warden for {getHostelLabel(studentProfile?.hostelId || user?.hostelId)}.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-indigo-100 bg-white px-3 py-2 text-[11px] text-slate-600 sm:col-span-2">
                Student: <strong className="text-slate-800">{studentProfile?.name || user?.name}</strong> · Enrollment: <strong className="text-slate-800">{studentProfile?.enrollmentNo || '—'}</strong> · Hostel: <strong className="text-slate-800">{getHostelLabel(studentProfile?.hostelId || user?.hostelId)}</strong>
              </div>
              <label className="text-[10px] font-semibold uppercase text-slate-600">Start Date
                <input type="date" required value={studentApplicationForm.startDate} onChange={(event) => setStudentApplicationForm((form) => ({ ...form, startDate: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs" />
              </label>
              <label className="text-[10px] font-semibold uppercase text-slate-600">End Date
                <input type="date" required min={studentApplicationForm.startDate || undefined} value={studentApplicationForm.endDate} onChange={(event) => setStudentApplicationForm((form) => ({ ...form, endDate: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs" />
              </label>
              <label className="text-[10px] font-semibold uppercase text-slate-600 sm:col-span-2">Reason
                <textarea required maxLength={500} rows={3} value={studentApplicationForm.reason} onChange={(event) => setStudentApplicationForm((form) => ({ ...form, reason: event.target.value }))} placeholder="Explain why you are requesting leave" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs normal-case" />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {feedback && <p role="status" className="text-[11px] text-indigo-800">{feedback}</p>}
              <button type="submit" disabled={isSubmittingApplication} className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{isSubmittingApplication ? 'Submitting…' : 'Submit Leave Application'}</button>
            </div>
          </form>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-800">My Leave Applications</h3>
              <button type="button" onClick={refreshStudentApplications} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Refresh status</button>
            </div>
            {leaveApplications.length === 0 ? <p className="text-[11px] text-slate-500">No leave applications submitted yet.</p> : (
              <ul className="divide-y divide-slate-100">
                {leaveApplications.map((application) => (
                  <li key={application.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[11px]">
                    <span className="text-slate-700">{application.startDate} to {application.endDate} · {application.reason}</span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${application.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : application.status === 'denied' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{application.status === 'denied' ? 'Denied' : application.status === 'approved' ? 'Approved' : 'Pending review'}</span>
                    {application.reviewNote && <span className="basis-full text-slate-500">Warden note: {application.reviewNote}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {isResidentialWarden && (
        <section className="rounded-xl border border-indigo-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Student Leave Applications</h2>
              <p className="mt-1 text-[11px] text-slate-500">Only requests for your assigned hostel ({getHostelLabel(user?.hostelId)}) are shown here.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">{leaveApplications.filter((application) => application.status === 'pending').length} pending</span>
          </div>
          {feedback && <p role="status" className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">{feedback}</p>}
          {leaveApplications.length === 0 ? (
            <p className="py-5 text-center text-xs text-slate-500">No student leave applications for your assigned hostel.</p>
          ) : (
            <div className="space-y-3">
              {leaveApplications.map((application) => (
                <article key={application.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{application.studentName} <span className="font-mono font-normal text-slate-500">({application.enrollmentNo})</span></div>
                      <div className="mt-1 text-[11px] text-slate-500">{getHostelLabel(application.hostelId)} · {application.block}, Room {application.roomNumber}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${application.status === 'pending' ? 'bg-amber-100 text-amber-800' : application.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{application.status}</span>
                  </div>
                  <div className="mt-3 text-xs font-semibold text-slate-800">{application.startDate} to {application.endDate}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{application.reason}</p>
                  {application.reviewNote && <p className="mt-2 text-[11px] text-slate-500">Review note: {application.reviewNote}</p>}
                  {application.status === 'pending' && (
                    <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                      <button type="button" disabled={reviewingApplicationId === application.id} onClick={() => reviewApplication(application.id, 'denied')} className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Deny</button>
                      <button type="button" disabled={reviewingApplicationId === application.id} onClick={() => reviewApplication(application.id, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{reviewingApplicationId === application.id ? 'Saving…' : 'Approve'}</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {isChiefWarden && (
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Institutional Holiday Calendar</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Official holidays apply to every active student across all hostels. Attendance is not required and no absence defaulters are created.</p>
            </div>
          </div>
          <form onSubmit={saveHoliday} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-end">
            <label className="text-[10px] font-semibold uppercase text-slate-600">Date
              <input type="date" required value={holidayStartDate} onChange={(e) => setHolidayStartDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs" />
            </label>
            <label className="text-[10px] font-semibold uppercase text-slate-600">End Date
              <input type="date" required min={holidayStartDate || undefined} value={holidayEndDate} onChange={(e) => setHolidayEndDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs" />
            </label>
            <label className="text-[10px] font-semibold uppercase text-slate-600 sm:col-span-2">Reason
              <input type="text" required maxLength={200} value={holidayReason} onChange={(e) => setHolidayReason(e.target.value)} placeholder="Enter the reason for this day off" className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs" />
            </label>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Mark Holiday</button>
          </form>
          {feedback && <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-800">{feedback}</div>}
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {visibleHolidays.length === 0 ? <p className="p-4 text-xs text-slate-500">No current or upcoming holiday dates are listed. Choose a start date, end date, and reason above to add one.</p> : visibleHolidays.map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between gap-3 p-3">
                <div><div className="text-xs font-semibold text-slate-800">{holiday.startDate === holiday.endDate ? holiday.startDate : `${holiday.startDate} to ${holiday.endDate}`}</div><div className="text-[11px] text-slate-600 mt-0.5">Reason: {holiday.reason}</div><div className="text-[10px] text-slate-400 mt-0.5">Applies to all hostels</div></div>
                <button type="button" onClick={() => deleteHoliday(holiday.id)} aria-label={`Remove holiday period ${holiday.startDate} to ${holiday.endDate}`} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[11px] text-slate-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mandatory Institutional Rule Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="font-bold">Leave approval procedure:</div>
          <p className="leading-relaxed text-[11px] text-blue-800">
            Students cannot directly approve leave in the system. An authorized warden records approved leave after verifying the application and parent consent. Once logged, automated absence emails are suppressed for the approved dates.
          </p>
        </div>
      </div>

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
                <th className="py-2.5 px-3">Alert Suppression</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
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
                    <td className="py-2.5 px-3 text-slate-700">{l.block}, Room {l.roomNumber}</td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">
                      {l.startDate} to {l.endDate}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs">{l.reason}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold flex items-center ${l.parentConsentVerified ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {l.parentConsentVerified && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}{l.parentConsentVerified ? 'Verified' : 'Not recorded'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{l.residentialWardenName}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        Suppressed
                      </span>
                    </td>
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
    </div>
  );
};
