import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  User,
  Building2,
  FileText,
  Filter,
  Search,
  ChevronRight,
  Clock
} from 'lucide-react';
import { WarningTicket } from '../../types';

interface WarningTicketsTableProps {
  hostelId?: string; // if provided, warden scope
  role?: string;
}

export const WarningTicketsTable: React.FC<WarningTicketsTableProps> = ({
  hostelId,
  role = 'director'
}) => {
  const [tickets, setTickets] = useState<WarningTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'strike_1' | 'strike_2' | 'flagged_for_admin_review'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'under_review' | 'resolved'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('hostel_auth_token') || localStorage.getItem('auth_token');
      const url = hostelId
        ? `/api/students/warning-tickets?hostelId=${hostelId}`
        : '/api/students/warning-tickets';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets);
      }
    } catch (err) {
      console.error('Failed to load warning tickets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [hostelId]);

  const handleUpdateStatus = async (ticketId: string, newStatus: 'active' | 'under_review' | 'resolved', notes?: string) => {
    setUpdatingId(ticketId);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/students/warning-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, adminNotes: notes })
      });
      const data = await res.json();
      if (data.success) {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? data.ticket : t))
        );
      }
    } catch (err) {
      console.error('Error updating ticket:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.enrollmentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.hostelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.parentPhone && t.parentPhone.includes(searchQuery));

    const matchesSeverity = severityFilter === 'all' || t.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const criticalCount = tickets.filter((t) => t.severity === 'flagged_for_admin_review').length;
  const strike2Count = tickets.filter((t) => t.severity === 'strike_2').length;
  const strike1Count = tickets.filter((t) => t.severity === 'strike_1').length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-600 text-white rounded-lg shadow-xs">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Automated Strike Records & Warning Disciplinary Tickets
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                Rule-Based Escalation
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracking late punches after 7:00 PM through 10:00 PM, punches after 10:00 PM, and missed check-ins evaluated at 10:00 PM. Accumulating multiple violations automatically flags them for Administrative Review.
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-2.5 py-1.5 rounded-lg bg-red-100 border border-red-200 text-red-900 font-medium">
            <span className="font-bold">{criticalCount}</span> Critical Admin Reviews
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-amber-100 border border-amber-200 text-amber-900 font-medium">
            <span className="font-bold">{strike2Count}</span> Strike 2 Tickets
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium">
            <span className="font-bold">{strike1Count}</span> Strike 1 Notices
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student, roll no, room, parent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-700"
          >
            <option value="all">All Violation Severities</option>
            <option value="flagged_for_admin_review">Flagged for Admin Review</option>
            <option value="strike_2">Strike 2 (Final Warning)</option>
            <option value="strike_1">Strike 1 (Initial Notice)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-700"
          >
            <option value="all">All Disciplinary Statuses</option>
            <option value="active">Active Tickets</option>
            <option value="under_review">Under Formal Review</option>
            <option value="resolved">Resolved / Excused</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading disciplinary strike records...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No warning tickets found matching filter.</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Student & Roll No</th>
                <th className="py-2.5 px-3">Hostel & Room</th>
                <th className="py-2.5 px-3">Violation History</th>
                <th className="py-2.5 px-3">Severity & Strikes</th>
                <th className="py-2.5 px-3">Parent Contact</th>
                <th className="py-2.5 px-3">Status & Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTickets.map((ticket) => {
                const isCritical = ticket.severity === 'flagged_for_admin_review';
                const isStrike2 = ticket.severity === 'strike_2';

                return (
                  <tr
                    key={ticket.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCritical ? 'bg-red-50/25' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{ticket.studentName}</div>
                      <div className="font-mono text-slate-500 text-[11px]">{ticket.enrollmentNo}</div>
                      <div className="text-[10px] text-slate-400">{ticket.course}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">{ticket.hostelName}</div>
                      <div className="text-slate-500 text-[11px]">Room {ticket.roomNumber} ({ticket.block})</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div className="text-amber-700 font-medium">
                          Late Grace Entries: <strong>{ticket.latePunchesCount}</strong>
                        </div>
                        <div className="text-red-700 font-medium">
                          Missed Check-ins: <strong>{ticket.missedCheckInsCount}</strong>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Total Violations: <strong>{ticket.totalViolations}</strong>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {isCritical ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-100 text-red-800 font-bold border border-red-300 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>Admin Review Required</span>
                        </div>
                      ) : isStrike2 ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Strike 2 Warning</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-300">
                          <span>Strike 1 Notice</span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1 max-w-xs">{ticket.reason}</p>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">{ticket.parentName}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 font-mono mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{ticket.parentPhone}</span>
                      </div>
                      {ticket.parentEmail && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                          <Mail className="w-2.5 h-2.5 text-slate-400" />
                          <span>{ticket.parentEmail}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide w-fit ${
                            ticket.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ticket.status === 'under_review'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {ticket.status.replace('_', ' ')}
                        </span>

                        {/* Action buttons based on role */}
                        <div className="flex items-center gap-1">
                          {ticket.status !== 'resolved' && (
                            <button
                              disabled={updatingId === ticket.id}
                              onClick={() => handleUpdateStatus(ticket.id, 'resolved', 'Addressed by official authority.')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-medium transition"
                            >
                              Resolve
                            </button>
                          )}
                          {ticket.status !== 'under_review' && (
                            <button
                              disabled={updatingId === ticket.id}
                              onClick={() => handleUpdateStatus(ticket.id, 'under_review', 'Summoned for Disciplinary Hearing.')}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-medium transition"
                            >
                              Summon Review
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
        <span>Showing {filteredTickets.length} of {tickets.length} total disciplinary violation records</span>
        <span className="font-mono">Enforced per Institute Attendance Statutes</span>
      </div>
    </div>
  );
};
