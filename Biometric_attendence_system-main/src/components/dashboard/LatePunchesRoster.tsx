import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  Building2,
  Search,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AttendanceRecord } from '../../types';

interface LatePunchesRosterProps {
  records: AttendanceRecord[];
  targetDate?: string;
  title?: string;
  role?: string; // 'director' | 'chief_warden' | 'warden'
  hostelId?: string;
  onDateChange?: (date: string) => void;
}

export const LatePunchesRoster: React.FC<LatePunchesRosterProps> = ({
  records,
  targetDate = '2026-10-27',
  title = 'Institution-Wide Late Punches Roster (7:00 PM - 10:00 PM)',
  role = 'director',
  hostelId = 'all',
  onDateChange
}) => {
  const [search, setSearch] = useState('');
  const [selectedHostel, setSelectedHostel] = useState<string>(hostelId);
  const [showAll, setShowAll] = useState(false);

  // Filter records
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

  const getMinutesLate = (punchTime?: string) => {
    if (!punchTime) return 'Late';
    const [h, m] = punchTime.split(':').map(Number);
    if (h === 19) {
      return `+${m}m past 7:00 PM`;
    } else if (h > 19) {
      const totalM = (h - 19) * 60 + m;
      return `+${totalM}m past 7:00 PM`;
    } else {
      return `On-Time`;
    }
  };

  const handleExportCSV = () => {
    const headers = ['Student Name', 'Roll Number', 'Hostel', 'Block', 'Room Number', 'Date', 'Punch Time', 'Delay Past Cutoff', 'Status', 'Remarks'];
    const rows = filtered.map((r) => [
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.enrollmentNo}"`,
      `"${getHostelDisplayName(r.hostelId)}"`,
      `"${r.block || ''}"`,
      `"${r.roomNumber || ''}"`,
      `"${r.date}"`,
      `"${r.punchTime || ''}"`,
      `"${getMinutesLate(r.punchTime)}"`,
      `"${r.status}"`,
      `"${(r.remarks || 'Grace Window Late Punch').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Late_Punches_${targetDate}_${selectedHostel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Banner */}
      <div className="p-4 bg-amber-50/80 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-amber-500 text-white rounded-lg shadow-xs">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                Grace Window Punches
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80 mt-0.5">
              Entries after 7:00 PM through 10:00 PM IST are marked Late. Punches after 10:00 PM become Defaulters; students without a punch are evaluated at 10:00 PM.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg shadow-xs">
              {filtered.length} Late Punches
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
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-600" />
              <label htmlFor={`late-punches-roster-date-${role}`} className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Select Date:
              </label>
              <input
                id={`late-punches-roster-date-${role}`}
                type="date"
                value={targetDate}
                onChange={(event) => {
                  if (event.target.value) onDateChange(event.target.value);
                }}
                aria-label="Select late punches roster date"
                className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 focus:border-amber-500 focus:outline-hidden"
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
            placeholder="Search student, roll no, room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-xs"
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

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
            <tr className="border-b border-slate-200">
              <th className="py-2.5 px-4">Student</th>
              <th className="py-2.5 px-4">Enrollment / Roll No</th>
              <th className="py-2.5 px-4">Hostel & Block</th>
              <th className="py-2.5 px-4">Room No</th>
              <th className="py-2.5 px-4">Recorded Punch Time</th>
              <th className="py-2.5 px-4">Cutoff Delay</th>
              <th className="py-2.5 px-4">Disciplinary Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No late biometric punches recorded for this selection.
                </td>
              </tr>
            ) : (
              visibleRecords.map((r) => (
                <tr key={r.id} className="hover:bg-amber-50/30 transition">
                  {/* Student Name */}
                  <td className="py-2.5 px-4">
                    <div className="font-bold text-slate-900">{r.studentName}</div>
                  </td>

                  {/* Enrollment / Roll No */}
                  <td className="py-2.5 px-4 font-mono text-slate-700 font-semibold">
                    {r.enrollmentNo}
                  </td>

                  {/* Hostel & Block */}
                  <td className="py-2.5 px-4 text-slate-700">
                    <span className="font-medium text-slate-900">{getHostelDisplayName(r.hostelId)}</span>
                    <span className="text-slate-500 block text-[11px]">{r.block}</span>
                  </td>

                  {/* Room No */}
                  <td className="py-2.5 px-4 font-mono text-slate-700">
                    Room {r.roomNumber}
                  </td>

                  {/* Recorded Punch Time */}
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-1.5 font-mono text-slate-800 font-bold">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{r.punchTime || '19:15:00'} IST</span>
                    </div>
                  </td>

                  {/* Cutoff Delay */}
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      {getMinutesLate(r.punchTime)}
                    </span>
                  </td>

                  {/* Disciplinary Status */}
                  <td className="py-2.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Late Entry (Grace Window)
                    </span>
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
            Displaying {visibleRecords.length} of {filtered.length} late punches on {targetDate}
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
        <span className="font-mono text-[11px]">Late: after 7:00 through 10:00 PM IST | Defaulter cutoff and no-punch evaluation: 10:00 PM IST</span>
      </div>
    </div>
  );
};
