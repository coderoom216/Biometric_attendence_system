import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  UserCheck,
  ShieldAlert,
  UserPlus,
  Filter,
  Download,
  Phone,
  Mail,
  GraduationCap,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Student, WarningTicket } from '../types';

export const StudentsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'directory' | 'verification'>('directory');
  const [students, setStudents] = useState<Student[]>([]);
  const [warningTickets, setWarningTickets] = useState<WarningTicket[]>([]);
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const isWardenOrAdmin = ['residential_warden', 'warden', 'chief_warden', 'director', 'caretaker_operator'].includes(user?.role || '');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getStudents();
      if (res.success) setStudents(res.students);

      const token = localStorage.getItem('auth_token');
      const ticketRes = await fetch('/api/students/warning-tickets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ticketData = await ticketRes.json();
      if (ticketData.success) {
        setWarningTickets(ticketData.tickets);
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

  const handleVerify = async (studentId: string, action: 'approve' | 'reject') => {
    setActionFeedback(null);
    try {
      const res = await apiService.verifyStudentRegistration(studentId, action);
      if (res.success) {
        setActionFeedback(res.message);
        loadData();
      }
    } catch (err: any) {
      setActionFeedback(err.response?.data?.message || 'Verification update failed');
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const url = hostelFilter !== 'all'
        ? `/api/students/export-directory-excel?hostelId=${hostelFilter}`
        : '/api/students/export-directory-excel';

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Master_Student_Directory_${hostelFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to export student directory:', err);
      alert('Failed to export Excel student directory.');
    } finally {
      setIsExporting(false);
    }
  };

  // Build ticket map
  const ticketByStudentId = new Map<string, WarningTicket>();
  warningTickets.forEach((t) => ticketByStudentId.set(t.studentId, t));

  // Filtered directory
  const filtered = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollmentNo.toLowerCase().includes(search.toLowerCase()) ||
      s.roomNumber.toLowerCase().includes(search.toLowerCase()) ||
      (s.parentPhone && s.parentPhone.includes(search)) ||
      s.course.toLowerCase().includes(search.toLowerCase());

    const matchesHostel = hostelFilter === 'all' || s.hostelId === hostelFilter;
    const matchesStatus = statusFilter === 'all' || s.verificationStatus === statusFilter;

    return matchesSearch && matchesHostel && matchesStatus;
  });

  const pendingCount = students.filter((s) => s.verificationStatus === 'pending_verification').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Student Administration & Master Directory</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Official University Register
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete records of active residents across Boys Hostel 1 (180 bed capacity), Girls Hostel (165 bed capacity), and Boys Hostel 2 (180 bed capacity).
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {isWardenOrAdmin && (
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center space-x-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Exporting...' : 'Export to Excel (.csv)'}</span>
            </button>
          )}

          <div className="text-right pl-3 border-l border-slate-200 hidden sm:block">
            <div className="text-xs text-slate-400 font-mono">Scoped Residents</div>
            <div className="text-base font-bold text-slate-800">{students.length} Records</div>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'directory'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Master Student List / Directory</span>
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-700 font-semibold">
            {students.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('verification')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'verification'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Registration Verification Queue</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-800 font-semibold animate-pulse">
              {pendingCount} Pending
            </span>
          )}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student, roll no, room, parent phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {(!user?.hostelId || ['director', 'chief_warden', 'caretaker_operator'].includes(user?.role || '')) && (
            <select
              value={hostelFilter}
              onChange={(e) => setHostelFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-700"
            >
              <option value="all">All Hostels (BH1, GH, BH2)</option>
              <option value="h-shivalik">Boys Hostel 1</option>
              <option value="h-mandakini">Girls Hostel</option>
              <option value="h-nilgiri">Boys Hostel 2</option>
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-700"
          >
            <option value="all">All Verification Statuses</option>
            <option value="verified">Verified Active</option>
            <option value="pending_verification">Pending Review</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Tab 1: Master Student List / Directory */}
      {activeTab === 'directory' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-800 text-xs">
                Official Directory View with Room, Roll No, Branch, Parent Phone & Disciplinary Standing
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Showing {filtered.length} of {students.length} students
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Room No</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Roll Number (Enrollment)</th>
                  <th className="py-2.5 px-3">Hostel & Block</th>
                  <th className="py-2.5 px-3">Branch / Course</th>
                  <th className="py-2.5 px-3">Parent Contact</th>
                  <th className="py-2.5 px-3">Biometric ID</th>
                  <th className="py-2.5 px-3">Disciplinary Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No students found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const ticket = ticketByStudentId.get(s.id);
                    const hostelName = s.hostelId === 'h-shivalik'
                      ? 'Boys Hostel 1'
                      : s.hostelId === 'h-mandakini'
                      ? 'Girls Hostel'
                      : 'Boys Hostel 2';

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        {/* Room Number */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 bg-slate-50/50">
                          Room {s.roomNumber}
                          <span className="text-[10px] text-slate-400 block font-normal">Bed {s.bedNumber || 'A'}</span>
                        </td>

                        {/* Student Name */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{s.name}</div>
                          <div className="text-[10px] text-slate-400">{s.studentEmail}</div>
                        </td>

                        {/* Roll Number */}
                        <td className="py-3 px-3 font-mono font-semibold text-blue-700">
                          {s.enrollmentNo}
                        </td>

                        {/* Hostel */}
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-medium text-slate-900">{hostelName}</div>
                          <div className="text-[11px] text-slate-500">{s.block}</div>
                        </td>

                        {/* Branch / Course */}
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-medium">{s.course}</div>
                          <div className="text-[10px] text-slate-400">Semester {s.semester}</div>
                        </td>

                        {/* Parent Phone Number */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-900">{s.parentName || 'Guardian'}</div>
                          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600 mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{s.parentPhone || '—'}</span>
                          </div>
                        </td>

                        {/* Biometric ID */}
                        <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                          {s.biometricId}
                        </td>

                        {/* Strikes / Warning Status */}
                        <td className="py-3 px-3">
                          {ticket ? (
                            ticket.severity === 'flagged_for_admin_review' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                Admin Review ({ticket.totalViolations} strikes)
                              </span>
                            ) : ticket.severity === 'strike_2' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Strike 2 Warning
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                Strike 1 Notice
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Good Standing
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Verification Queue */}
      {activeTab === 'verification' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-slate-800 text-xs">
              Student Registration Requests Requiring Formal Warden Verification (FR-02)
            </span>
            <span className="text-[11px] text-slate-500">
              Audited in Institute Master Register
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Student Details</th>
                  <th className="py-3 px-4">Course & Year</th>
                  <th className="py-3 px-4">Hostel / Block / Room</th>
                  <th className="py-3 px-4">Biometric ID</th>
                  <th className="py-3 px-4">Parent Details</th>
                  <th className="py-3 px-4">Verification</th>
                  {isWardenOrAdmin && <th className="py-3 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{s.enrollmentNo}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div>{s.course}</div>
                      <div className="text-[10px] text-slate-400">Sem {s.semester}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        {s.hostelId === 'h-shivalik' ? 'Boys Hostel 1' : s.hostelId === 'h-mandakini' ? 'Girls Hostel' : 'Boys Hostel 2'}
                      </div>
                      <div className="text-[11px] text-slate-500">{s.block}, Room {s.roomNumber}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 font-semibold">{s.biometricId}</td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{s.parentName || 'Guardian'}</div>
                      <div className="font-mono text-[11px] text-slate-500">{s.parentPhone}</div>
                      {s.parentEmail ? (
                        <span className="text-[10px] text-slate-400 block">{s.parentEmail}</span>
                      ) : (
                        <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[9px]">
                          Missing Email
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {s.verificationStatus === 'verified' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Verified
                        </span>
                      )}
                      {s.verificationStatus === 'pending_verification' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                          Pending Review
                        </span>
                      )}
                      {s.verificationStatus === 'rejected' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                          Rejected
                        </span>
                      )}
                    </td>
                    {isWardenOrAdmin && (
                      <td className="py-3 px-4 text-right">
                        {s.verificationStatus === 'pending_verification' ? (
                          <div className="space-x-1.5">
                            <button
                              onClick={() => handleVerify(s.id, 'approve')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition cursor-pointer"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleVerify(s.id, 'reject')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-semibold transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Verified Official</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
