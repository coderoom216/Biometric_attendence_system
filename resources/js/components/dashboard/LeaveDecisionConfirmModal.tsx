import React from 'react';
import { LeaveRecord } from '../../types';

interface LeaveDecisionConfirmModalProps {
  leave: LeaveRecord | null;
  action: 'approved' | 'rejected' | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const calculateInclusiveLeaveDays = (startDate: string, endDate: string): number => {
  const startParts = startDate.split('-').map(Number);
  const endParts = endDate.split('-').map(Number);
  if (startParts.length !== 3 || endParts.length !== 3) return 1;

  const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
  const endUtc = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);
  if (isNaN(startUtc) || isNaN(endUtc) || endUtc < startUtc) return 1;

  return Math.round((endUtc - startUtc) / 86400000) + 1;
};

export const LeaveDecisionConfirmModal: React.FC<LeaveDecisionConfirmModalProps> = ({
  leave,
  action,
  isSubmitting = false,
  onCancel,
  onConfirm,
}) => {
  if (!leave || !action) {
    return null;
  }

  const days = leave.daysCount || calculateInclusiveLeaveDays(leave.startDate, leave.endDate);
  const isApprove = action === 'approved';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-decision-confirm-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
      >
        <h3 id="leave-decision-confirm-title" className="text-lg font-bold text-slate-900">
          {isApprove ? 'Approve leave application?' : 'Reject leave application?'}
        </h3>

        <div className="space-y-1.5 text-sm text-slate-600">
          <p className="text-xs text-slate-500">
            Student: <strong className="text-slate-800">{leave.studentName}</strong> ({leave.enrollmentNo})
          </p>
          <p>
            This application is for <strong className="text-slate-900">{days} {days === 1 ? 'day' : 'days'}</strong>:
          </p>
          <p className="font-bold text-slate-900 font-mono">
            {leave.startDate} to {leave.endDate}
          </p>
          <p className="pt-1">
            {isApprove ? 'Do you want to approve it?' : 'Do you want to reject it?'}
          </p>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-50 ${
              isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {isSubmitting ? 'Updating...' : isApprove ? 'Yes, approve' : 'Yes, reject'}
          </button>
        </div>
      </section>
    </div>
  );
};
