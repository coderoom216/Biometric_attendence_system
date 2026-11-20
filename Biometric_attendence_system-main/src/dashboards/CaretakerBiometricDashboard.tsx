import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Upload,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { apiService } from '../services/api';
import { BiometricDevice, Hostel, Student } from '../types';

export const CaretakerBiometricDashboard: React.FC = () => {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('bdev-shiv-01');
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Onboard form state (FR-02)
  const [studentForm, setStudentForm] = useState<{
    enrollmentNo: string;
    name: string;
    course: string;
    semester: number;
    gender: 'male' | 'female' | 'other';
    hostelId: string;
    block: string;
    roomNumber: string;
    bedNumber: string;
    biometricId: string;
    studentEmail: string;
    studentPhone: string;
    parentName: string;
    parentEmail: string;
    parentPhone: string;
  }>({
    enrollmentNo: '',
    name: '',
    course: 'B.Tech CSE',
    semester: 1,
    gender: 'male',
    hostelId: 'h-shivalik',
    block: 'Block A',
    roomNumber: '102',
    bedNumber: 'B',
    biometricId: `BIO-${Math.floor(1000 + Math.random() * 9000)}`,
    studentEmail: '',
    studentPhone: '+91 98',
    parentName: '',
    parentEmail: '',
    parentPhone: '+91 98'
  });
  const [onboardFeedback, setOnboardFeedback] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const devRes = await apiService.getBiometricDevices();
      if (devRes.success) setDevices(devRes.devices);

      const hRes = await apiService.getHostels();
      if (hRes.success) setHostels(hRes.hostels);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Run Biometric Log Sync from Local Device (FR-01)
  const handleSyncPunches = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      // Simulate punches fetched locally by Mr. Mehra from offline terminal
      const simulatedLocalPunches = [
        { biometricId: 'BIO-SHIV-01', punchTime: '18:15:22', punchTimestamp: '2026-10-27 18:15:22' },
        { biometricId: 'BIO-MAND-01', punchTime: '18:48:10', punchTimestamp: '2026-10-27 18:48:10' },
        { biometricId: 'BIO-SHIV-03', punchTime: '18:20:00', punchTimestamp: '2026-10-27 18:20:00' },
        { biometricId: 'BIO-MAND-02', punchTime: '18:22:45', punchTimestamp: '2026-10-27 18:22:45' }
      ];

      const res = await apiService.syncBiometricLogs(selectedDevice, simulatedLocalPunches);
      if (res.success) {
        setSyncStatus(res);
        loadData();
      }
    } catch (err: any) {
      setSyncStatus({ error: err.response?.data?.message || 'Sync failed' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Onboard verified student (FR-02)
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardFeedback(null);
    try {
      const res = await apiService.onboardStudent(studentForm);
      if (res.success) {
        setOnboardFeedback(`Student ${studentForm.name} successfully registered and verified in central DB.`);
        setStudentForm({
          enrollmentNo: '',
          name: '',
          course: 'B.Tech CSE',
          semester: 1,
          gender: 'male',
          hostelId: 'h-shivalik',
          block: 'Block A',
          roomNumber: '102',
          bedNumber: 'B',
          biometricId: `BIO-${Math.floor(1000 + Math.random() * 9000)}`,
          studentEmail: '',
          studentPhone: '+91 98',
          parentName: '',
          parentEmail: '',
          parentPhone: '+91 98'
        });
      }
    } catch (err: any) {
      setOnboardFeedback(err.response?.data?.message || 'Failed to onboard student');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Biometric Terminal & Caretaker Onboarding Portal</h1>

          </div>
          <p className="text-xs text-slate-500 mt-1">
            Offline Biometric Device Log Ingestion (FR-01) & Verified Student Master Record Entry (FR-02)
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400 font-mono">Terminal Protocol: ESSL/ZKTeco</div>
          <div className="text-xs font-bold text-emerald-700">Authorized Ingestion Script</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Biometric Offline Log Sync Interface (FR-01) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-indigo-700 font-bold text-sm border-b border-slate-100 pb-3">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <span>Biometric Hardware Synchronization Terminal (FR-01)</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs leading-relaxed">
            <strong>Architecture Note (From Requirements Report):</strong> Biometric devices store punch data locally without direct LAN connectivity. Mr. Mehra holds administrative credentials to retrieve local logs and execute the authorized push script into the central portal DB.
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
                Select Biometric Hardware Terminal
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-xs font-medium"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.deviceId}) — {d.status === 'online_synced' ? 'Synced' : 'Stale (>24h)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] space-y-1">
              <div className="text-slate-400"># Authorized Terminal Ingestion CLI</div>
              <div className="text-emerald-400">$ fetch-local-biometric --device={selectedDevice} --format=raw_log</div>
              <div className="text-slate-300">Punches after 7:00 PM through 10:00 PM IST are late; punches after 10:00 PM are defaulters. Students without a punch are evaluated at 10:00 PM.</div>
            </div>

            <button
              disabled={isSyncing}
              onClick={handleSyncPunches}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Ingesting Punch Logs...' : 'Ingest Offline Biometric Logs to Central DB'}</span>
            </button>

            {syncStatus && !syncStatus.error && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs space-y-1 animate-in fade-in">
                <div className="font-bold flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                  <span>{syncStatus.message}</span>
                </div>
                <div className="text-[11px] text-emerald-700">
                  Processed: <strong>{syncStatus.processedCount}</strong> | Duplicates Ignored: <strong>{syncStatus.duplicateCount}</strong> | Unrecognized IDs: <strong>{syncStatus.unrecognizedCount}</strong>
                </div>
              </div>
            )}

            {syncStatus?.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                {syncStatus.error}
              </div>
            )}
          </div>

          {/* Terminal Health Cards */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[10px] font-semibold uppercase text-slate-400 mb-2">Device Status Registry</div>
            <div className="space-y-2">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">{d.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Last Sync: {d.lastSyncAt}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.status === 'online_synced' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {d.status === 'online_synced' ? 'Online Synced' : 'Stale Pending Import'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Onboard Verified Student Master Record (FR-02) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-indigo-700 font-bold text-sm border-b border-slate-100 pb-3">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <span>Onboard Verified Student Record (FR-02)</span>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs leading-relaxed">
            <strong>Director's Explicit Directive:</strong> Students will not enter authoritative data. Caretakers / Officials input verified profile details (Enrollment No, Name, Room, Parent Email, Biometric ID).
          </div>

          <form onSubmit={handleOnboardSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Enrollment Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 24BCSE101"
                  value={studentForm.enrollmentNo}
                  onChange={(e) => setStudentForm({ ...studentForm, enrollmentNo: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg uppercase font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ankit Saxena"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Course</label>
                <input
                  type="text"
                  required
                  value={studentForm.course}
                  onChange={(e) => setStudentForm({ ...studentForm, course: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Biometric Hardware ID</label>
                <input
                  type="text"
                  required
                  value={studentForm.biometricId}
                  onChange={(e) => setStudentForm({ ...studentForm, biometricId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Hostel</label>
                <select
                  value={studentForm.hostelId}
                  onChange={(e) => setStudentForm({ ...studentForm, hostelId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Block</label>
                <input
                  type="text"
                  required
                  value={studentForm.block}
                  onChange={(e) => setStudentForm({ ...studentForm, block: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Room No</label>
                <input
                  type="text"
                  required
                  value={studentForm.roomNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, roomNumber: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Student Email</label>
                <input
                  type="email"
                  required
                  placeholder="student@university.edu.in"
                  value={studentForm.studentEmail}
                  onChange={(e) => setStudentForm({ ...studentForm, studentEmail: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Parent Email (For 6-Tier Alerts)</label>
                <input
                  type="email"
                  required
                  placeholder="parent@example.com"
                  value={studentForm.parentEmail}
                  onChange={(e) => setStudentForm({ ...studentForm, parentEmail: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {onboardFeedback && (
              <div className={`p-2.5 rounded-lg text-xs ${onboardFeedback.includes('successfully') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {onboardFeedback}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition shadow-xs mt-2"
            >
              Onboard & Link Biometric ID to Student
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
