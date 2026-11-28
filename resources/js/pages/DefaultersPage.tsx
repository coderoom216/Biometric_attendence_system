import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  Download,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceRecord, NotificationLog } from '../types';
import { DateQuickPresets } from '../components/dashboard/DateQuickPresets';

export const DefaultersPage: React.FC = () => {
  const { user } = useAuth();
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [selectedDate, setSelectedDate] = useState<string>(todayIst);
  const [defaulters, setDefaulters] = useState<AttendanceRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [search, setSearch] = useState('');
  const [selectedHostel, setSelectedHostel] = useState('all');
  const [virtualTime, setVirtualTime] = useState('19:15:00');
  const [isPastDefaulter, setIsPastDefaulter] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async (dateToLoad = selectedDate) => {
    setIsLoading(true);
    try {
      const defRes = await apiService.getDefaulters(dateToLoad);
      if (defRes.success) {
        setDefaulters(defRes.defaulters);
        setVirtualTime(defRes.virtualTime);
        setIsPastDefaulter(defRes.isDefaulterListVisible);
      }

      const notifRes = await apiService.getNotificationLogs({ date: dateToLoad });
      if (notifRes.success) {
        setNotifications(notifRes.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [user, selectedDate]);

  const filteredDefaulters = defaulters.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (d.studentName || '').toLowerCase().includes(q) ||
      (d.enrollmentNo || '').toLowerCase().includes(q) ||
      (d.roomNumber || '').includes(search);
    const matchesHostel = selectedHostel === 'all' || String(d.hostelId) === String(selectedHostel);
    return matchesSearch && matchesHostel;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">10:00 PM IST Defaulter Roster</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
              FR-07 Defaulter Identification
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Punches after 10:00 PM IST and students without a punch at the 10:00 PM IST evaluation are defaulters, with sequential 6-tier alerts.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href={`/api/reports/export-defaulters-csv?startDate=${selectedDate}&endDate=${selectedDate}`}
            download
            className="flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Defaulter List (CSV)</span>
          </a>
          <button
            type="button"
            onClick={() => loadData(selectedDate)}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Timing Warning / Status */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${isPastDefaulter ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
        <div className="flex items-center space-x-3">
          <Clock className={`w-5 h-5 ${isPastDefaulter ? 'text-rose-600' : 'text-amber-600'}`} />
          <div>
            <div className="font-bold">
              {isPastDefaulter
                ? `Simulated Time: ${virtualTime} IST — 10:00 PM Defaulter Evaluation Time`
                : `Simulated Time: ${virtualTime} IST — Late punches accepted through 10:00 PM`}
            </div>
            <div className="text-[11px] opacity-80 mt-0.5">
              Punches from 7:30 PM through 10:00 PM IST are Late Punches. Punches after 10:00 PM are defaulters; students without a punch are flagged at 10:00 PM.
            </div>
          </div>
        </div>

        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800">
          Cutoff: 19:30 IST • Late 19:30–22:00
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search student, enrollment, or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/40 px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <label htmlFor="defaulters-page-date" className="font-medium text-slate-600 whitespace-nowrap">
              Select Date:
            </label>
            <input
              id="defaulters-page-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
            />
            <DateQuickPresets value={selectedDate} onChange={setSelectedDate} tone="rose" />
          </div>

          {/* Hostel Selector if privileged */}
          {['director', 'chief_warden', 'caretaker_operator'].includes(user?.role || '') && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium">Hostel:</span>
              <select
                value={selectedHostel}
                onChange={(e) => setSelectedHostel(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="all">All Hostels</option>
                <option value="h-shivalik">Boys Hostel 1 (Capacity: 180 beds)</option>
                <option value="h-mandakini">Girls Hostel (Capacity: 165 beds)</option>
                <option value="h-nilgiri">Boys Hostel 2 (Capacity: 180 beds)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Defaulters Roster Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Student Details</th>
                <th className="py-3 px-4">Hostel / Block / Room</th>
                <th className="py-3 px-4">Cutoff Freeze</th>
                <th className="py-3 px-4">Sequential 6-Tier Email Hierarchy</th>
                <th className="py-3 px-4">Evaluation Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDefaulters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No defaulters found matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredDefaulters.map((d) => {
                  const studentNotifs = notifications.filter((n) => n.studentId === d.studentId);
                  const failedTier = studentNotifs.find((n) => n.status === 'failed');

                  return (
                    <tr key={d.id} className="hover:bg-rose-50/20 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{d.studentName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{d.enrollmentNo}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {d.hostelId === 'h-shivalik' ? 'Boys Hostel 1' : d.hostelId === 'h-mandakini' ? 'Girls Hostel' : 'Boys Hostel 2'}
                        </div>
                        <div className="text-[11px] text-slate-500">{d.block}, Room {d.roomNumber}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        {d.punchTime ? 'Punch after 10:00 PM' : 'No punch by 10:00 PM'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{d.evaluatedAt}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                              T1-T4 Sent
                            </span>
                            <span className="text-[11px] text-slate-600">RW, Warden, CW, Director</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            {failedTier ? (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold" title={failedTier.failureReason}>
                                T5 Failed: Missing Parent Email
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                                T5 Parent Alert Sent
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {d.remarks || (d.punchTime ? 'Punch recorded after 10:00 PM IST.' : 'No biometric punch recorded by the 10:00 PM IST evaluation.')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
