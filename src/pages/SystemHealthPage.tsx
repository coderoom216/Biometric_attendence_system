import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Edit,
  Building2
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { NotificationLog } from '../types';

export const SystemHealthPage: React.FC = () => {
  const { user } = useAuth();
  const [healthData, setHealthData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Parent email fix state
  const [fixStudentId, setFixStudentId] = useState<string | null>(null);
  const [newParentEmail, setNewParentEmail] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const hRes = await apiService.getBiometricHealth();
      if (hRes.success) setHealthData(hRes);

      const aRes = await apiService.getAuditLogs();
      if (aRes.success) setAuditLogs(aRes.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleRetryNotification = async (notifId: string, overrideEmail?: string) => {
    setRetryMsg(null);
    try {
      const res = await apiService.retryNotification(notifId, overrideEmail);
      if (res.success) {
        setRetryMsg(`Alert retried successfully. Status updated to delivered.`);
        setFixStudentId(null);
        setNewParentEmail('');
        loadData();
      }
    } catch (err: any) {
      setRetryMsg(err.response?.data?.message || 'Retry failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Failure Handling & System Health (FR-12)</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${healthData?.systemHealth === 'Optimal' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              Health Status: {healthData?.systemHealth || 'Active'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Proactive failure monitoring: stale biometric terminals, missing parent contacts, and notification retry engine.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center space-x-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Health Diagnostics</span>
        </button>
      </div>

      {retryMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{retryMsg}</span>
        </div>
      )}

      {/* Health Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs uppercase font-semibold">
            <span>Stale Biometric Terminals</span>
            <Cpu className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{healthData?.staleDevicesCount || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {healthData?.staleDevicesCount > 0 ? 'Requires Mr. Mehra local sync' : 'All terminals synced <24h'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs uppercase font-semibold">
            <span>Missing Parent Emails</span>
            <Mail className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">{healthData?.missingParentEmailsCount || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Prevents Tier 5 absence alert dispatch
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs uppercase font-semibold">
            <span>Notification Delivery Failures</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">{healthData?.notificationFailuresCount || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Logged in exception table below
          </div>
        </div>
      </div>

      {/* Stale Biometric Logs Detection (FR-12) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>Biometric Hardware Synchronization Health</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Mr. Mehra (Computer Science Dept)</span>
        </div>

        {healthData?.staleDevices?.length > 0 ? (
          <div className="space-y-2">
            {healthData.staleDevices.map((dev: any) => (
              <div key={dev.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-amber-900">{dev.name} ({dev.id})</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">Location: {dev.location} • Last Sync: {dev.lastSync}</div>
                </div>
                <span className="px-2 py-1 bg-amber-200 text-amber-900 font-bold rounded text-[10px]">
                  Stale (&gt;24 Hours without Import)
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-emerald-700 p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>All campus biometric terminals are current and synchronized within the active 24-hour cycle.</span>
          </div>
        )}
      </div>

      {/* Missing Parent Email Exception Resolution (FR-12) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
            <Mail className="w-4 h-4 text-amber-600" />
            <span>Missing Parent Email Resolution Queue (FR-03 & FR-12)</span>
          </div>
          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold">
            {healthData?.missingParentEmails?.length || 0} Students Flagged
          </span>
        </div>

        {healthData?.missingParentEmails?.map((stu: any) => (
          <div key={stu.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-900">{stu.name} ({stu.enrollmentNo})</div>
              <div className="text-[11px] text-slate-500">
                Hostel: {stu.hostel} • Room {stu.room} • <span className="text-rose-600 font-semibold">Parent email missing from master profile</span>
              </div>
            </div>

            {fixStudentId === stu.id ? (
              <div className="flex items-center space-x-2">
                <input
                  type="email"
                  placeholder="Enter parent email..."
                  value={newParentEmail}
                  onChange={(e) => setNewParentEmail(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded text-xs w-48"
                />
                <button
                  onClick={() => {
                    const failNotif = healthData.notificationFailures.find((n: any) => n.studentId === stu.id);
                    if (failNotif) {
                      handleRetryNotification(failNotif.id, newParentEmail);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700"
                >
                  Save & Retry
                </button>
                <button onClick={() => setFixStudentId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setFixStudentId(stu.id);
                  setNewParentEmail('');
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer"
              >
                Provide Parent Email & Retry Alert
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Notification Delivery Failures Log with Retry Action (FR-12) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-rose-800 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Notification Failure & Retry Log (FR-12)</span>
          </div>
          <span className="text-xs text-rose-700 font-mono">Sequential Escalation Monitor</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Tier & Role</th>
                <th className="py-2.5 px-4">Student</th>
                <th className="py-2.5 px-4">Failure Reason</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4 text-right">Recovery Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {healthData?.notificationFailures?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No failed notifications currently logged.
                  </td>
                </tr>
              ) : (
                healthData?.notificationFailures?.map((n: NotificationLog) => (
                  <tr key={n.id}>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      Tier {n.tier}: {n.recipientRole}
                    </td>
                    <td className="py-2.5 px-4">{n.studentName} ({n.enrollmentNo})</td>
                    <td className="py-2.5 px-4 text-rose-700 font-medium">{n.failureReason}</td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{n.timestamp}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => {
                          const email = prompt('Enter recipient email to retry dispatch:');
                          if (email) handleRetryNotification(n.id, email);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry Dispatch</span>
                      </button>
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
