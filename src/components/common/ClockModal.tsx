import React, { useState } from 'react';
import { Clock, Play, RotateCcw, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { apiService } from '../../services/api';

interface ClockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClockUpdated: () => void;
  currentVirtualTime: string;
  currentVirtualDate: string;
}

export const ClockModal: React.FC<ClockModalProps> = ({
  isOpen,
  onClose,
  onClockUpdated,
  currentVirtualTime,
  currentVirtualDate
}) => {
  const [customTime, setCustomTime] = useState(currentVirtualTime || '19:02:00');
  const [isExecuting, setIsExecuting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSetTime = async (timeStr: string) => {
    setIsExecuting(true);
    setFeedback(null);
    try {
      const res = await apiService.setVirtualClock(timeStr);
      if (res.success) {
        setCustomTime(timeStr);
        setFeedback(`Clock shifted to ${timeStr} IST`);
        onClockUpdated();
      }
    } catch {
      setFeedback('Failed to adjust clock');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTriggerCutoff = async () => {
    setIsExecuting(true);
    setFeedback(null);
    try {
      const res = await apiService.triggerCutoffEvaluation();
      if (res.success) {
        setFeedback('9:00 PM IST defaulter evaluation completed. Defaulters locked & 6-tier alerts queued.');
        onClockUpdated();
      }
    } catch (err: any) {
      setFeedback(err.response?.data?.message || 'Evaluation trigger failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-lg">IST Attendance Clock & Scheduler Simulator</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600 leading-relaxed">
                The on-time cutoff is <strong className="text-slate-900">7:00 PM IST</strong>. Entries after that and through <strong className="text-slate-900">9:00 PM IST</strong> are marked Late. Students without a punch by 9:00 PM are categorized as Defaulters. Use the presets below to simulate any phase.
          </p>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Current Simulated Time</div>
            <div className="text-2xl font-mono font-bold text-slate-800 flex items-center space-x-2">
              <span>{currentVirtualTime} IST</span>
              <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                {currentVirtualDate}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Quick Timing Presets
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={isExecuting}
                onClick={() => handleSetTime('18:45:00')}
                className="flex items-center justify-center space-x-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-medium transition cursor-pointer"
              >
                <span>6:45 PM (On-Time Punch)</span>
              </button>
              <button
                disabled={isExecuting}
                onClick={() => handleSetTime('19:15:00')}
                className="flex items-center justify-center space-x-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-medium transition cursor-pointer"
              >
                <span>7:15 PM (Grace Window: Late)</span>
              </button>
              <button
                disabled={isExecuting}
                onClick={() => handleSetTime('21:00:00')}
                className="flex items-center justify-center space-x-2 p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-medium transition cursor-pointer"
              >
                <span>9:00 PM (Grace Expiry)</span>
              </button>
              <button
                disabled={isExecuting}
                onClick={() => handleSetTime('21:01:00')}
                className="flex items-center justify-center space-x-2 p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-medium transition cursor-pointer"
              >
                <span>7:31 PM (Defaulters Escalated)</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <button
              disabled={isExecuting}
              onClick={handleTriggerCutoff}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>Execute 9:00 PM Defaulter Evaluation & Notification Job</span>
            </button>
          </div>

          {feedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-md hover:bg-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
