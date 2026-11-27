import React, { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { apiService } from '../../services/api';
import { LeaveRecord } from '../../types';

interface EditLeaveModalProps {
  leave: LeaveRecord | null;
  onClose: () => void;
  onSaved: (updatedLeave: LeaveRecord, message: string) => void;
}

export const EditLeaveModal: React.FC<EditLeaveModalProps> = ({
  leave,
  onClose,
  onSaved,
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [reason, setReason] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>('approved');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!leave) return;
    setStartDate(leave.startDate || '');
    setEndDate(leave.endDate || '');
    setGatePassNo(leave.gatePassNo || '');
    setReason(leave.reason || '');
    const normalized =
      leave.approvalStatus ||
      (leave.status === 'Rejected' ? 'rejected' : leave.status === 'Pending' ? 'pending' : 'approved');
    setApprovalStatus(normalized);
    setErrorMsg(null);
  }, [leave]);

  if (!leave) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);
    try {
      const res = await apiService.updateLeave(leave.id, {
        startDate,
        endDate,
        gatePassNo,
        reason,
        approvalStatus,
      });
      if (res.success) {
        onSaved(res.leave, res.message || 'Leave updated successfully.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Unable to update leave record.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-leave-modal-title"
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95"
      >
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-indigo-400" />
            <h3 id="edit-leave-modal-title" className="font-semibold text-sm">
              Edit Leave — {leave.studentName} ({leave.enrollmentNo})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close edit leave modal"
            className="text-slate-400 hover:text-white p-1 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-leave-start" className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                Start Date
              </label>
              <input
                id="edit-leave-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="edit-leave-end" className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                End Date
              </label>
              <input
                id="edit-leave-end"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-leave-gatepass" className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                Gate Pass Number
              </label>
              <input
                id="edit-leave-gatepass"
                type="text"
                required
                value={gatePassNo}
                onChange={(e) => setGatePassNo(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="edit-leave-status" className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                Approval Status
              </label>
              <select
                id="edit-leave-status"
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="edit-leave-reason" className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
              Reason / Remarks
            </label>
            <input
              id="edit-leave-reason"
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            />
          </div>

          {errorMsg && (
            <div role="alert" className="p-2.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Leave Changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
