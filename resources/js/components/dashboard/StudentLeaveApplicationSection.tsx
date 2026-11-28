import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { apiService } from '../../services/api';
import { LeaveRecord, Student } from '../../types';

interface StudentLeaveApplicationSectionProps {
  profile: Student | null;
  studentName: string;
  leaves: LeaveRecord[];
  onSubmitted: () => Promise<void> | void;
}

const getHostelCodeLabel = (hostelId?: string) => {
  if (!hostelId) return 'Hostel';
  const normalized = hostelId.toLowerCase();
  if (normalized === '1' || normalized.includes('shivalik') || normalized === 'bh1') return 'BH1';
  if (normalized === '2' || normalized.includes('mandakini') || normalized === 'gh') return 'GH';
  if (normalized === '3' || normalized.includes('nilgiri') || normalized === 'bh2') return 'BH2';
  return hostelId;
};

export const StudentLeaveApplicationSection: React.FC<StudentLeaveApplicationSectionProps> = ({
  profile,
  studentName,
  leaves,
  onSubmitted,
}) => {
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [startDate, setStartDate] = useState(todayIst);
  const [endDate, setEndDate] = useState(todayIst);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hostelCode = getHostelCodeLabel(profile?.hostelId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!startDate || !endDate) {
      setFeedback({ type: 'error', text: 'Please select both start date and end date.' });
      return;
    }
    if (startDate < todayIst) {
      setFeedback({ type: 'error', text: 'Leave start date cannot be in the past.' });
      return;
    }
    if (endDate < startDate) {
      setFeedback({ type: 'error', text: 'Leave end date cannot be earlier than start date.' });
      return;
    }
    if (reason.trim().length < 3) {
      setFeedback({ type: 'error', text: 'Please enter a valid reason for your leave application.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiService.applyStudentLeave({
        startDate,
        endDate,
        reason: reason.trim(),
      });
      setReason('');
      setFeedback({
        type: 'success',
        text: res.message || 'Leave application submitted successfully (Pending Warden approval).',
      });
      await onSubmitted();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Unable to submit leave application.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Apply for Leave Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-bold text-slate-900 text-sm">Apply for Leave</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Your application goes to the Residential Warden for {hostelCode}.
          </p>
        </div>

        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Student: <strong className="text-slate-900">{profile?.name || studentName}</strong>
          </span>
          <span>
            Enrollment: <strong className="text-slate-900 font-mono">{profile?.enrollmentNo || '—'}</strong>
          </span>
          <span>
            Hostel: <strong className="text-slate-900">{hostelCode}</strong>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="student-leave-start" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Start Date
              </label>
              <input
                id="student-leave-start"
                type="date"
                required
                min={todayIst}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="student-leave-end" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                End Date
              </label>
              <input
                id="student-leave-end"
                type="date"
                required
                min={startDate || todayIst}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label htmlFor="student-leave-reason" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Reason
            </label>
            <textarea
              id="student-leave-reason"
              required
              rows={3}
              placeholder="Enter the reason for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          {feedback && (
            <div
              role={feedback.type === 'error' ? 'alert' : 'status'}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Leave Application'}
            </button>
          </div>
        </form>
      </div>

      {/* My Leave Applications & Status Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>My Leave Applications &amp; Approved Leaves</span>
          </div>
          <span className="text-xs text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full font-medium">
            Automated Absence Suppression Active
          </span>
        </div>

        {leaves.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No leave applications submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Gate Pass No</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Reviewed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaves.map((l) => {
                  const isPending = l.status === 'Pending' || l.approvalStatus === 'pending';
                  const isRejected = l.status === 'Rejected' || l.approvalStatus === 'rejected';
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{l.gatePassNo}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono">
                        {l.startDate} to {l.endDate}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{l.reason}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPending
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : isRejected
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {!isPending && !isRejected && <CheckCircle2 className="w-3 h-3" />}
                          {isPending ? 'Pending' : isRejected ? 'Rejected' : 'Approved'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {l.approvedBy || l.residentialWardenName || 'Pending Warden'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-[11px] leading-relaxed">
            Once your Residential Warden approves a submitted leave application, automated absence emails and defaulter flags are suppressed for those approved dates.
          </p>
        </div>
      </div>
    </div>
  );
};
