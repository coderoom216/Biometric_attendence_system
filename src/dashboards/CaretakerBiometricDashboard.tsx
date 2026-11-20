import React, { useState, useEffect } from 'react';
import {
  Cpu,
  UserPlus,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { apiService } from '../services/api';
import { BiometricDevice, Hostel, Student } from '../types';

export const CaretakerBiometricDashboard: React.FC = () => {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('bdev-shiv-01');
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    model: '',
    serialNumber: '',
    location: '',
    installationDate: '',
    installedBy: '',
    installationNotes: ''
  });
  const [isSavingDevice, setIsSavingDevice] = useState(false);
  const [deviceFeedback, setDeviceFeedback] = useState<string | null>(null);

  // Onboard form state (FR-02)
  const [studentForm, setStudentForm] = useState<{
    enrollmentNo: string;
    name: string;
    course: string;
    branch: string;
    year: number;
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
    branch: 'Computer Science and Engineering',
    year: 1,
    semester: 1,
    gender: 'male',
    hostelId: 'h-shivalik',
    block: 'Block A',
    roomNumber: '102',
    bedNumber: 'B',
    biometricId: `BIO-${Math.floor(1000 + Math.random() * 9000)}`,
    studentEmail: '',
    studentPhone: '',
    parentName: '',
    parentEmail: '',
    parentPhone: ''
  });
  const [onboardFeedback, setOnboardFeedback] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const devRes = await apiService.getBiometricDevices();
      if (devRes.success) {
        const availableDevices = devRes.devices.filter((device) => device.hostelId !== 'h-mandakini');
        setDevices(availableDevices);
        const selected = availableDevices.find((device) => device.id === selectedDevice) || availableDevices[0];
        if (selected) {
          setSelectedDevice(selected.id);
          setDeviceForm({
            name: selected.name || '',
            model: selected.model || '',
            serialNumber: selected.serialNumber || selected.deviceId || '',
            location: selected.location || '',
            installationDate: selected.installationDate || '',
            installedBy: selected.installedBy || '',
            installationNotes: selected.installationNotes || ''
          });
        }
      }

      const hRes = await apiService.getHostels();
      if (hRes.success) setHostels(hRes.hostels.filter((hostel) => hostel.id !== 'h-mandakini'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeviceDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceFeedback(null);
    setIsSavingDevice(true);
    try {
      const res = await apiService.updateBiometricDevice(selectedDevice, deviceForm);
      if (res.success) {
        setDevices((current) => current.map((device) => device.id === res.device.id ? res.device : device));
        setDeviceFeedback(res.message);
      }
    } catch (err: any) {
      setDeviceFeedback(err.response?.data?.message || 'Could not save device details.');
    } finally {
      setIsSavingDevice(false);
    }
  };

  const handleDeviceSelection = (deviceId: string) => {
    const device = devices.find((entry) => entry.id === deviceId);
    setSelectedDevice(deviceId);
    setDeviceFeedback(null);
    if (device) {
      setDeviceForm({
        name: device.name || '',
        model: device.model || '',
        serialNumber: device.serialNumber || device.deviceId || '',
        location: device.location || '',
        installationDate: device.installationDate || '',
        installedBy: device.installedBy || '',
        installationNotes: device.installationNotes || ''
      });
    }
  };

  // Run Biometric Log Sync from Local Device (FR-01)
  const handleSyncPunches = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      // Simulate punches fetched locally from the offline terminal
      const simulatedLocalPunches = [
        { biometricId: 'BIO-SHIV-01', punchTime: '18:15:22', punchTimestamp: '2026-10-27 18:15:22' },
        { biometricId: 'BIO-SHIV-03', punchTime: '18:20:00', punchTimestamp: '2026-10-27 18:20:00' },
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
        setOnboardFeedback(`Student ${studentForm.name} submitted for resident warden verification.`);
        setStudentForm({
          enrollmentNo: '',
          name: '',
          course: 'B.Tech CSE',
          branch: 'Computer Science and Engineering',
          year: 1,
          semester: 1,
          gender: 'male',
          hostelId: 'h-shivalik',
          block: 'Block A',
          roomNumber: '102',
          bedNumber: 'B',
          biometricId: `BIO-${Math.floor(1000 + Math.random() * 9000)}`,
          studentEmail: '',
          studentPhone: '',
          parentName: '',
          parentEmail: '',
          parentPhone: ''
        });
      }
    } catch (err: any) {
      setOnboardFeedback(err.response?.data?.message || 'Failed to onboard student');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Biometric Offline Log Sync Interface (FR-01) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-indigo-700 font-bold text-sm border-b border-slate-100 pb-3">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <span>Biometric Hardware Synchronization Terminal (FR-01)</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
                Select Biometric Hardware Terminal
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => handleDeviceSelection(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-xs font-medium"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.deviceId}) — {d.status === 'online_synced' ? 'Synced' : 'Stale (>24h)'}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleDeviceDetailsSubmit} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="text-xs font-bold text-slate-800">Device Installation Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block font-semibold text-slate-600 text-[10px] uppercase">
                  Device Name
                  <input required value={deviceForm.name} onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="e.g. Boys Hostel 1 Main Gate" className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-normal normal-case" />
                </label>
                <label className="block font-semibold text-slate-600 text-[10px] uppercase">
                  Device Model
                  <input required value={deviceForm.model} onChange={(e) => setDeviceForm({ ...deviceForm, model: e.target.value })} placeholder="e.g. ESSL K30" className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-normal normal-case" />
                </label>
                <label className="block font-semibold text-slate-600 text-[10px] uppercase">
                  Serial Number / Device Code
                  <input required value={deviceForm.serialNumber} onChange={(e) => setDeviceForm({ ...deviceForm, serialNumber: e.target.value })} className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-mono font-normal normal-case" />
                </label>
                <label className="block font-semibold text-slate-600 text-[10px] uppercase">
                  Installation Location
                  <input required value={deviceForm.location} onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })} placeholder="e.g. Main entrance" className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-normal normal-case" />
                </label>
                <label className="block font-semibold text-slate-600 text-[10px] uppercase">
                  Installation Date
                  <input required type="date" value={deviceForm.installationDate} onChange={(e) => setDeviceForm({ ...deviceForm, installationDate: e.target.value })} className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-normal normal-case" />
                </label>
                <label className="block font-semibold text-slate-600 text-[10px] uppercase">
                  Installed By
                  <input required value={deviceForm.installedBy} onChange={(e) => setDeviceForm({ ...deviceForm, installedBy: e.target.value })} placeholder="Installer's full name" className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-normal normal-case" />
                </label>
              </div>
              <label className="block font-semibold text-slate-600 text-[10px] uppercase">
                Additional Details
                <textarea value={deviceForm.installationNotes} onChange={(e) => setDeviceForm({ ...deviceForm, installationNotes: e.target.value })} rows={2} placeholder="Optional notes about the device or installation" className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-normal normal-case" />
              </label>
              {deviceFeedback && (
                <div className={`p-2 rounded-lg text-xs ${deviceFeedback.includes('saved') ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {deviceFeedback}
                </div>
              )}
              <button type="submit" disabled={isSavingDevice} className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                {isSavingDevice ? 'Saving Device Details…' : 'Save Device Details'}
              </button>
            </form>

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
                    <div className="text-[10px] text-slate-500">{d.model || 'Model not recorded'} · {d.location}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Last Sync: {d.lastSyncAt}</div>
                    <div className="text-[10px] text-slate-400">Installed {d.installationDate || 'date not recorded'}{d.installedBy ? ` by ${d.installedBy}` : ''}</div>
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
            <strong>Registration details:</strong> Enter the student's verified profile and room assignment. A resident warden will review and verify the record.
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
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Branch</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science and Engineering"
                  value={studentForm.branch}
                  onChange={(e) => setStudentForm({ ...studentForm, branch: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Year of Study</label>
                <select
                  required
                  value={studentForm.year}
                  onChange={(e) => setStudentForm({ ...studentForm, year: Number(e.target.value) })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {[1, 2, 3, 4, 5, 6].map((year) => <option key={year} value={year}>Year {year}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Semester</label>
                <select
                  value={studentForm.semester}
                  onChange={(e) => setStudentForm({ ...studentForm, semester: Number(e.target.value) })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Gender</label>
                <select
                  value={studentForm.gender}
                  onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as 'male' | 'female' | 'other' })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
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

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Bed</label>
                <select
                  value={studentForm.bedNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, bedNumber: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="A">Bed A</option>
                  <option value="B">Bed B</option>
                  <option value="C">Bed C</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Student Phone</label>
                <input
                  type="tel"
                  value={studentForm.studentPhone}
                  onChange={(e) => setStudentForm({ ...studentForm, studentPhone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Parent / Guardian Name</label>
                <input
                  type="text"
                  value={studentForm.parentName}
                  onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Parent Email or Phone</label>
                <input
                  type="text"
                  placeholder="Email address or phone number"
                  value={studentForm.parentEmail || studentForm.parentPhone}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    setStudentForm({ ...studentForm, parentEmail: value.includes('@') ? value : '', parentPhone: value.includes('@') ? '' : value });
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {onboardFeedback && (
              <div className={`p-2.5 rounded-lg text-xs ${onboardFeedback.includes('submitted') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {onboardFeedback}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition shadow-xs mt-2"
            >
              Submit for Resident Warden Verification
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
