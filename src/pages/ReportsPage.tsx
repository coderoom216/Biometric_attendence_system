import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Search,
  Filter,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  AlertOctagon,
  FileText
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceRecord } from '../types';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('2026-10-25');
  const [endDate, setEndDate] = useState('2026-10-27');
  const [hostelFilter, setHostelFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getAttendanceHistory({
        startDate,
        endDate,
        status: statusFilter === 'all' ? undefined : statusFilter,
        hostelId: hostelFilter === 'all' ? undefined : hostelFilter,
        search: search || undefined
      });
      if (res.success) {
        setHistory(res.records);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [startDate, endDate, statusFilter, hostelFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  const presentCount = history.filter((h) => h.status === 'present').length;
  const lateCount = history.filter((h) => h.status === 'late').length;
  const leaveCount = history.filter((h) => h.status === 'approved_leave').length;
  const defaulterCount = history.filter((h) => h.isDefaulter || h.status === 'absent').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Historical Attendance & Search (FR-09, FR-13)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Authorized Scoped Search
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Query, filter, and export daily, hostel-wise, block-wise historical records and audit-locked entries.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href="/api/reports/export-attendance-csv"
            download
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Full Attendance CSV</span>
          </a>
          <a
            href="/api/reports/export-defaulters-csv"
            download
            className="flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Defaulters CSV</span>
          </a>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Attendance Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present (On-Time)</option>
              <option value="late">Late Punch</option>
              <option value="approved_leave">Approved Leave</option>
              <option value="absent">Defaulter / Absent</option>
            </select>
          </div>

          {['director', 'chief_warden', 'caretaker_operator'].includes(user?.role || '') && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Hostel</label>
              <select
                value={hostelFilter}
                onChange={(e) => setHostelFilter(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="all">All Hostels</option>
                <option value="h-shivalik">Boys Hostel 1</option>
                <option value="h-mandakini">Girls Hostel</option>
                <option value="h-nilgiri">Boys Hostel 2</option>
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition"
            >
              Filter Records
            </button>
          </div>
        </form>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by student name, enrollment ID, or room number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* KPI Tally of Queried Results */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Filtered Records</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{history.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Present Records</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{presentCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Approved Leaves</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{leaveCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Defaulters Logged</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{defaulterCount}</div>
        </div>
      </div>

      {/* Historical Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Enrollment No</th>
                <th className="py-2.5 px-3">Hostel & Room</th>
                <th className="py-2.5 px-3">Punch Time</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Remarks / Audit Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No historical attendance records match the selected query.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-medium text-slate-800">{h.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{h.studentName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{h.enrollmentNo}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {h.hostelId === 'h-shivalik' ? 'Boys Hostel 1' : h.hostelId === 'h-mandakini' ? 'Girls Hostel' : 'Boys Hostel 2'} ({h.block}, Room {h.roomNumber})
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {h.punchTime ? `${h.punchTime} IST` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {h.status === 'present' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Present
                        </span>
                      )}
                      {h.status === 'late' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                          Late Punch
                        </span>
                      )}
                      {h.status === 'approved_leave' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                          Approved Leave
                        </span>
                      )}
                      {h.status === 'absent' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                          Defaulter
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                      {h.remarks || (h.correctedBy ? `Corrected by ${h.correctedBy}` : 'Biometric Turnstile Ingestion')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
