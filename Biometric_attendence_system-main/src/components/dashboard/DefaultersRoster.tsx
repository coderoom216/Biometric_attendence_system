import React, { useState } from 'react';
import {
  AlertOctagon,
  Building2,
  Search,
  Filter,
  Download,
  Calendar,
  Mail,
  CheckCircle2,
  Phone,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AttendanceRecord } from '../../types';

interface DefaultersRosterProps {
  records: AttendanceRecord[];
  targetDate?: string;
  title?: string;
  role?: string;
  hostelId?: string;
  onDateChange?: (date: string) => void;
}

export const DefaultersRoster: React.FC<DefaultersRosterProps> = ({
  records,
  targetDate = '2026-10-27',
  title = 'Institution-Wide After-10:00 PM / No-Punch Defaulters Roster',
  role = 'director',
  hostelId = 'all',
  onDateChange
}) => {
  const [search, setSearch] = useState('');
  const [selectedHostel, setSelectedHostel] = useState<string>(hostelId);
  const [showAll, setShowAll] = useState(false);

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.studentName.toLowerCase().includes(search.toLowerCase()) ||
      r.enrollmentNo.toLowerCase().includes(search.toLowerCase()) ||
      r.roomNumber.includes(search) ||
      (r.block && r.block.toLowerCase().includes(search.toLowerCase()));

    const matchesHostel = selectedHostel === 'all' || r.hostelId === selectedHostel;

    return matchesSearch && matchesHostel;
  });
  const visibleRecords = showAll ? filtered : filtered.slice(0, 5);

  const getHostelDisplayName = (hId: string) => {
    if (hId === 'h-shivalik') return 'Boys Hostel 1';
    if (hId === 'h-mandakini') return 'Girls Hostel';
    if (hId === 'h-nilgiri') return 'Boys Hostel 2';
    return hId;
  };

  const handleExportCSV = () => {
    const headers = ['Student Name', 'Roll Number', 'Hostel', 'Block', 'Room Number', 'Date', 'Cutoff Status', 'Escalation Status', 'Remarks'];
    const rows = filtered.map((r) => [
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.enrollmentNo}"`,
      `"${getHostelDisplayName(r.hostelId)}"`,
      `"${r.block || ''}"`,
      `"${r.roomNumber || ''}"`,
      `"${r.date}"`,
      `"Punch after 10:00 PM or no punch by 10:00 PM"`,
      `"6-Tier Escalation Active"`,
      `"${(r.remarks || 'Punch after 10:00 PM or no biometric punch by 10:00 PM').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Defaulters_${targetDate}_${selectedHostel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Banner */}
      <div className="p-4 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-rose-600 text-white rounded-lg shadow-xs">
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                Action Required
              </span>
            </div>
            <p className="text-[11px] text-rose-900 mt-0.5">
              Punches after 10:00 PM or no punch by the 10:00 PM IST evaluation are flagged as defaulters. Approved leave is excluded; 6-tier alerts are triggered.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-rose-600 text-white px-3 py-1.5 rounded-lg shadow-xs">
              {filtered.length} Total Defaulters
            </span>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>
          {onDateChange && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-rose-600" />
              <label htmlFor={`defaulters-roster-date-${role}`} className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Select Date:
              </label>
              <input
                id={`defaulters-roster-date-${role}`}
                type="date"
                value={targetDate}
                onChange={(event) => {
                  if (event.target.value) onDateChange(event.target.value);
                }}
                aria-label="Select defaulters roster date"
                className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
              />
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search defaulter, roll no, room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-rose-500 text-xs"
          />
        </div>

        {hostelId === 'all' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium">Hostel:</span>
            <select
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-700"
            >
              <option value="all">All Hostels (BH1, GH, BH2)</option>
              <option value="h-shivalik">Boys Hostel 1</option>
              <option value="h-mandakini">Girls Hostel</option>
              <option value="h-nilgiri">Boys Hostel 2</option>
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
            <tr className="border-b border-slate-200">
              <th className="py-2.5 px-4">Student</th>
              <th className="py-2.5 px-4">Enrollment / Roll No</th>
              <th className="py-2.5 px-4">Hostel & Block</th>
              <th className="py-2.5 px-4">Room No</th>
              <th className="py-2.5 px-4">Defaulter Cutoff</th>
              <th className="py-2.5 px-4">6-Tier Alert Hierarchy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No defaulters recorded for this selection. All residents present or on approved leave.
                </td>
              </tr>
            ) : (
              visibleRecords.map((d) => (
                <tr key={d.id} className="hover:bg-rose-50/20 transition">
                  {/* Student */}
                  <td className="py-2.5 px-4">
                    <div className="font-bold text-slate-900">{d.studentName}</div>
                  </td>

                  {/* Enrollment No */}
                  <td className="py-2.5 px-4 font-mono text-slate-700 font-semibold">
                    {d.enrollmentNo}
                  </td>

                  {/* Hostel & Block */}
                  <td className="py-2.5 px-4 text-slate-700">
                    <span className="font-medium text-slate-900">{getHostelDisplayName(d.hostelId)}</span>
                    <span className="text-slate-500 block text-[11px]">{d.block}</span>
                  </td>

                  {/* Room No */}
                  <td className="py-2.5 px-4 font-mono text-slate-700">
                    Room {d.roomNumber}
                  </td>

                  {/* Cutoff Status */}
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      {d.punchTime ? 'Punch after 10:00 PM' : 'No punch by 10:00 PM'}
                    </span>
                  </td>

                  {/* 6-Tier Alert Hierarchy */}
                  <td className="py-2.5 px-4">
                    <div className="text-[11px] text-slate-700 flex items-center gap-1.5">
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Tiers 1-4 Delivered
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">Warden, CW & Director Notified</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span>
            Displaying {visibleRecords.length} of {filtered.length} defaulters on {targetDate}
          </span>
          {filtered.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((isShowingAll) => !isShowingAll)}
              className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
              aria-expanded={showAll}
            >
              {showAll ? (
                <>
                  Show less
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  View more ({filtered.length - 5})
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}
        </div>
        <span className="font-mono text-[11px]">Late through 10:00 PM IST | Defaulter cutoff and no-punch evaluation: 10:00 PM IST</span>
      </div>
    </div>
  );
};
