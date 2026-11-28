
import React, { useState, useEffect } from 'react';
import {
  Cpu,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  Fingerprint,
  Users,
  Activity,
  Clock,
  ShieldCheck,
  Wifi,
  WifiOff,
  Key
} from 'lucide-react';
import { apiService } from '../services/api';
import { BiometricDevice, Hostel, Room } from '../types';
import { SixTierAbsenceAlerts } from '../components/dashboard/SixTierAbsenceAlerts';

const DEVICE_SERIAL = 'RSS20241199684';

interface EnrolledUser {
  userId: string;
  deviceSerial: string;
  deviceName?: string;
  name: string | null;
  hostelId?: string;
  hostelName?: string;
  hostelCode?: string;
  privilege: string | null;
  enabled?: boolean | null;
  hasInfo: boolean;
  infoFetchedAt?: string | null;
  fingerprintEnrolled: boolean;
  fingerprintCount: number;
  isRegistered?: boolean;
  studentId?: string | null;
  enrollmentNo?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
}

interface StudentFormData {
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
}

const createInitialForm = (hostelId = ''): StudentFormData => ({
  enrollmentNo: '',
  name: '',
  course: 'B.Tech CSE',
  semester: 1,
  gender: 'male',
  hostelId,
  block: '',
  roomNumber: '',
  bedNumber: '',
  biometricId: '',
  studentEmail: '',
  studentPhone: '',
  parentName: '',
  parentEmail: '',
  parentPhone: ''
});

export const CaretakerBiometricDashboard: React.FC = () => {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [hostelRooms, setHostelRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [enrolledUsers, setEnrolledUsers] = useState<EnrolledUser[]>([]);
  const [selectedMachineUserId, setSelectedMachineUserId] = useState('');
  const [studentForm, setStudentForm] = useState<StudentFormData>(
    createInitialForm()
  );

  const [liveData, setLiveData] = useState<any>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [onboardFeedback, setOnboardFeedback] = useState<string | null>(null);
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState<{
    name: string;
    email: string;
    password?: string;
    enrollmentNo?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingDevice, setIsSyncingDevice] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [registrationMode, setRegistrationMode] = useState<
    'device' | 'manual'
  >('device');

  const [selectedEnrolledHostel, setSelectedEnrolledHostel] = useState<string>('all');
  const [selectedLiveHostel, setSelectedLiveHostel] = useState<string>('all');

  const selectedMachineUser = enrolledUsers.find(
    (user) => user.userId === selectedMachineUserId
  );

  const livePunches = Array.isArray(liveData?.punches)
    ? liveData.punches
    : [];

  const enrolledCounts = React.useMemo(() => {
    const counts = { all: enrolledUsers.length, BH1: 0, GH: 0, BH2: 0 };
    enrolledUsers.forEach((u) => {
      const code = (u.hostelCode || '').toUpperCase();
      if (code === 'BH1' || u.hostelId === '1') counts.BH1++;
      else if (code === 'GH' || u.hostelId === '2') counts.GH++;
      else if (code === 'BH2' || u.hostelId === '3') counts.BH2++;
    });
    return counts;
  }, [enrolledUsers]);

  const filteredEnrolledUsers = React.useMemo(() => {
    if (selectedEnrolledHostel === 'all') return enrolledUsers;
    return enrolledUsers.filter((u) => {
      const code = (u.hostelCode || '').toUpperCase();
      if (selectedEnrolledHostel === 'BH1') return code === 'BH1' || u.hostelId === '1';
      if (selectedEnrolledHostel === 'GH') return code === 'GH' || u.hostelId === '2';
      if (selectedEnrolledHostel === 'BH2') return code === 'BH2' || u.hostelId === '3';
      return true;
    });
  }, [enrolledUsers, selectedEnrolledHostel]);

  const liveCounts = React.useMemo(() => {
    const counts = { all: livePunches.length, BH1: 0, GH: 0, BH2: 0 };
    livePunches.forEach((p: any) => {
      const code = (p.hostelCode || (p.hostelId === '2' ? 'GH' : p.hostelId === '3' ? 'BH2' : 'BH1')).toUpperCase();
      if (code === 'BH1') counts.BH1++;
      else if (code === 'GH') counts.GH++;
      else if (code === 'BH2') counts.BH2++;
    });
    return counts;
  }, [livePunches]);

  const filteredLivePunches = React.useMemo(() => {
    if (selectedLiveHostel === 'all') return livePunches;
    return livePunches.filter((p: any) => {
      const code = (p.hostelCode || (p.hostelId === '2' ? 'GH' : p.hostelId === '3' ? 'BH2' : 'BH1')).toUpperCase();
      return code === selectedLiveHostel;
    });
  }, [livePunches, selectedLiveHostel]);

  const loadHostels = async () => {
    try {
      const response = await apiService.getHostels();

      if (response.success) {
        setHostels(response.hostels);

        if (response.hostels.length > 0) {
          setStudentForm((previous) => ({
            ...previous,
            hostelId: previous.hostelId || response.hostels[0].id
          }));
        }
      }
    } catch (error) {
      console.error('Hostel loading failed:', error);
    }
  };

  const loadRoomsForHostel = async (hostelId: string) => {
    if (!hostelId) {
      setHostelRooms([]);
      return;
    }

    setIsLoadingRooms(true);
    try {
      const response = await apiService.getHostelRooms(hostelId);
      if (response.success && Array.isArray(response.rooms)) {
        setHostelRooms(response.rooms);
      } else {
        setHostelRooms([]);
      }
    } catch (error) {
      console.error('Hostel rooms loading failed:', error);
      setHostelRooms([]);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const loadDevices = async () => {
    try {
      const response = await apiService.getBiometricDevices();

      if (response.success) {
        setDevices(response.devices);
      }
    } catch (error) {
      console.error('Device loading failed:', error);
    }
  };

  const loadEnrolledUsers = async () => {
    try {
      const response = await apiService.getBiometricEnrolledUsers();

      if (response.success) {
        setEnrolledUsers(response.users || []);
      }
    } catch (error: any) {
      console.error('Enrolled users loading failed:', error);
      setPageError(
        error.response?.data?.message ||
          'Failed to load machine enrolled users from terminal.'
      );
    }
  };

  const loadLivePunches = async () => {
    try {
      const response = await apiService.getLiveBiometricPunches();
      setLiveData(response);
      setLiveError(null);
    } catch (error: any) {
      setLiveError(
        error.response?.data?.message ||
          'Failed to read live punches from biometric database.'
      );
    }
  };

  const handleSyncFromMachine = async () => {
    setIsSyncingDevice(true);
    setSyncFeedback('Fetch command dispatched to terminal... refreshing in 6 seconds.');

    try {
      await apiService.triggerBiometricUserFetch(DEVICE_SERIAL);

      // 6 seconds delay allows device full heartbeat + template processing cycle
      setTimeout(async () => {
        await loadEnrolledUsers();
        setIsSyncingDevice(false);
        setSyncFeedback('New terminal enrollments synchronized successfully.');
        setTimeout(() => setSyncFeedback(null), 5000);
      }, 6000);
    } catch (error: any) {
      setIsSyncingDevice(false);
      setSyncFeedback(
        error.response?.data?.message || 'Failed to dispatch sync command to device.'
      );
    }
  };

  const refreshAllData = async () => {
    setIsLoading(true);
    setPageError(null);

    // Trigger sync in background so device responds on next 3s ping
    apiService.triggerBiometricUserFetch(DEVICE_SERIAL).catch(() => {});

    await Promise.all([
      loadHostels(),
      loadDevices(),
      loadEnrolledUsers(),
      loadLivePunches()
    ]);

    setIsLoading(false);
  };

  useEffect(() => {
    refreshAllData();

    const timer = window.setInterval(() => {
      loadDevices();
      loadEnrolledUsers();
      loadLivePunches();
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (studentForm.hostelId) {
      loadRoomsForHostel(studentForm.hostelId);
    }
  }, [studentForm.hostelId]);

  // Filter vacant rooms: only rooms with at least 1 available bed
  const vacantRooms = hostelRooms.filter((r) => {
    if (typeof r.availableBeds === 'number') {
      return r.availableBeds > 0;
    }
    if (typeof r.capacity === 'number' && typeof r.currentOccupancy === 'number') {
      return r.currentOccupancy < r.capacity;
    }
    return !r.isFull;
  });

  // Current selected room object
  const currentRoom = hostelRooms.find(
    (r) => String(r.roomNumber) === String(studentForm.roomNumber)
  );

  // Compute vacant beds for the current selected room
  const availableBedsForCurrentRoom = React.useMemo(() => {
    if (!currentRoom) return [];
    if (Array.isArray(currentRoom.vacantBeds) && currentRoom.vacantBeds.length > 0) {
      return currentRoom.vacantBeds;
    }
    const cap = currentRoom.capacity || 3;
    const allBeds = ['A', 'B', 'C', 'D'].slice(0, cap);
    const occupied = (currentRoom.occupants || []).map((o: any) =>
      String(o.bedNumber || o.bed || '').toUpperCase().trim()
    );
    return allBeds.filter((b) => !occupied.includes(b));
  }, [currentRoom]);

  const handleRoomSelect = (roomNum: string) => {
    const selected = hostelRooms.find((r) => String(r.roomNumber) === String(roomNum));
    const vacantList = selected?.vacantBeds && selected.vacantBeds.length > 0
      ? selected.vacantBeds
      : ['A', 'B', 'C'];
    const autoBed = vacantList[0] || 'A';

    setStudentForm((prev) => ({
      ...prev,
      roomNumber: roomNum,
      bedNumber: autoBed,
      block: selected?.block || prev.block || 'Block A'
    }));
  };

  const handleMachineUserChange = (userId: string) => {
    setSelectedMachineUserId(userId);
    setOnboardFeedback(null);
    setLastCreatedCredentials(null);

    const machineUser = enrolledUsers.find(
      (user) => user.userId === userId
    );

    if (!machineUser) {
      setStudentForm((previous) => ({
        ...previous,
        biometricId: ''
      }));
      return;
    }

    const cleanName = (machineUser.name || '').trim();
    const slugName = cleanName
      ? cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.')
      : `resident${machineUser.userId}`;
    const autoEmail = `${slugName}@student.edu.in`;
    const autoEnrollment = machineUser.enrollmentNo || `2024BIO${String(machineUser.userId).padStart(3, '0')}`;

    setStudentForm((previous) => {
      const targetHostelId = machineUser.hostelId || previous.hostelId;
      const roomToSet = machineUser.roomNumber || previous.roomNumber || (vacantRooms.length > 0 ? vacantRooms[0].roomNumber : '');
      const matchedRoom = hostelRooms.find((r) => String(r.roomNumber) === String(roomToSet));
      const bedToSet = machineUser.bedNumber || previous.bedNumber || matchedRoom?.vacantBeds?.[0] || 'A';

      return {
        ...previous,
        hostelId: targetHostelId || previous.hostelId,
        biometricId: machineUser.userId,
        name: cleanName || previous.name || `Resident ${machineUser.userId}`,
        enrollmentNo: autoEnrollment,
        studentEmail: cleanName ? autoEmail : (previous.studentEmail || autoEmail),
        roomNumber: roomToSet,
        bedNumber: bedToSet,
        block: matchedRoom?.block || previous.block || 'Block A'
      };
    });
  };

  const handleDeviceRegistration = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setOnboardFeedback(null);
    setLastCreatedCredentials(null);

    if (!selectedMachineUser) {
      setOnboardFeedback('Please select a biometric terminal User ID first.');
      return;
    }

    if (!studentForm.hostelId) {
      setOnboardFeedback('Please select an assigned hostel.');
      return;
    }

    setIsSubmitting(true);

    try {
      const mappedDev = devices.find((d: any) => String(d.hostelId) === String(studentForm.hostelId));
      const targetSerial = mappedDev?.deviceSerial || selectedMachineUser.deviceSerial || 'RSS20241199684';

      const response =
        await apiService.submitDeviceStudentRegistration({
          ...studentForm,
          biometricId: selectedMachineUser.userId,
          deviceSerial: targetSerial
        });

      if (response.success) {
        const creds = (response as any).credentials || {
          name: studentForm.name,
          email: studentForm.studentEmail,
          password: 'student123',
          enrollmentNo: studentForm.enrollmentNo,
        };
        setLastCreatedCredentials(creds);

        setOnboardFeedback(
          'Student registration verified & added to Active Residents successfully!'
        );

        setSelectedMachineUserId('');
        setStudentForm(createInitialForm(studentForm.hostelId));

        await loadEnrolledUsers();
        await loadLivePunches();
        if (studentForm.hostelId) {
          await loadRoomsForHostel(studentForm.hostelId);
        }
      } else {
        setOnboardFeedback(
          response.message || 'Student registration submission failed.'
        );
      }
    } catch (error: any) {
      setOnboardFeedback(
        error.response?.data?.message ||
          'Device-linked student registration failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualOnboard = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setOnboardFeedback(null);
    setLastCreatedCredentials(null);

    if (!studentForm.biometricId.trim()) {
      setOnboardFeedback('Please enter a Biometric ID for manual onboarding.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiService.onboardStudent(studentForm);

      if (response.success) {
        const creds = (response as any).credentials || {
          name: studentForm.name,
          email: studentForm.studentEmail,
          password: 'student123',
          enrollmentNo: studentForm.enrollmentNo,
        };
        setLastCreatedCredentials(creds);

        setOnboardFeedback(
          `Student ${studentForm.name} successfully registered and verified.`
        );

        setStudentForm(createInitialForm(studentForm.hostelId));
        setSelectedMachineUserId('');
        if (studentForm.hostelId) {
          await loadRoomsForHostel(studentForm.hostelId);
        }
      } else {
        setOnboardFeedback(
          response.message || 'Student onboarding failed.'
        );
      }
    } catch (error: any) {
      setOnboardFeedback(
        error.response?.data?.message || 'Failed to onboard student.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const mongoConnected = liveData?.mongo?.connected === true;
  const deviceOnline = liveData?.device?.online === true || devices.some((d: any) => d.isOnline === true || d.status === 'online_synced');
  const heartbeatSeconds = liveData?.device?.secondsAgo;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Biometric Terminal & Student Onboarding
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Actual machine users, real-time hardware status, and student registration
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAllData}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Connection Status: 4 Cards showing Physical Device, MongoDB, Enrolled Users, Punches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Physical Biometric Device Live Status */}
        <div className={`bg-white rounded-xl border p-5 transition-all ${
          deviceOnline ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 bg-rose-50/20'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                  deviceOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`} />
                <p className="text-xs text-slate-500 font-semibold">
                  Physical Machine (S362)
                </p>
              </div>
              <p className={`text-lg font-bold mt-2 ${
                deviceOnline ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {deviceOnline ? 'Connected (Live)' : 'Disconnected (Offline)'}
              </p>
            </div>
            {deviceOnline ? (
              <Wifi className="w-8 h-8 text-emerald-500" />
            ) : (
              <WifiOff className="w-8 h-8 text-rose-500" />
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {deviceOnline
              ? `Live heartbeat active (~${heartbeatSeconds ?? 3}s ago)`
              : 'Hardware powered off or network disconnected'}
          </p>
        </div>

        {/* MongoDB Database Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">
                Database (MongoDB)
              </p>
              <p className={`text-lg font-bold mt-2 ${
                mongoConnected ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {mongoConnected ? 'Connected (Local)' : 'Not Connected'}
              </p>
            </div>
            <Database className={`w-8 h-8 ${
              mongoConnected ? 'text-emerald-500' : 'text-rose-500'
            }`} />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            biometric_db (Port 27017)
          </p>
        </div>

        {/* Machine Enrolled Users */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">
                Machine Enrolled Users
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {enrolledUsers.length}
              </p>
            </div>
            <Users className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Users fetched from device records
          </p>
        </div>

        {/* Punch Records */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">
                Punch Records
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {liveData?.total ?? 0}
              </p>
            </div>
            <Activity className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Records in biometric punch collection
          </p>
        </div>

      </div>

      {/* Hostel Biometric Terminals (BH1, GH, BH2) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Hostel Biometric Terminals ({devices.length} Assigned Terminals)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Boys Hostel 1 • Girls Hostel • Boys Hostel 2
          </span>
        </div>

        {/* 3 Terminal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {devices.map((device: any) => {
            const isDevOnline = device.isOnline === true || device.status === 'online_synced';
            const badgeColor = 
              device.hostelCode === 'GH'
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : device.hostelCode === 'BH2'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-indigo-100 text-indigo-800 border-indigo-200';

            return (
              <div
                key={device.id}
                className={`p-4 rounded-xl border transition-all ${
                  isDevOnline
                    ? 'border-emerald-300 bg-emerald-50/30 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${badgeColor}`}>
                    {device.hostelCode || `Hostel ${device.hostelId}`}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    isDevOnline
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isDevOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {isDevOnline ? 'Online (Live)' : 'Standby / Ready'}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="font-bold text-slate-900 text-sm">
                    {device.name || device.deviceName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assigned: <strong className="text-slate-700">{device.hostelName}</strong>
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Terminal Serial:</span>
                    <span className="font-mono font-semibold text-slate-800">{device.deviceSerial || device.deviceId}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>IP / Hardware:</span>
                    <span className="font-mono text-slate-600">{device.ipAddress} • S362</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Mapped Residents:</span>
                    <span className="font-bold text-indigo-700">{device.studentCount ?? 0} Students</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enrolled Machine Users */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Actual Machine Enrolled Users
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSyncFromMachine}
              disabled={isSyncingDevice}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDevice ? 'animate-spin' : ''}`} />
              <span>{isSyncingDevice ? 'Syncing Machine...' : 'Pull Latest from Machine'}</span>
            </button>

            <span className="text-xs text-slate-500">
              Auto refresh: 10 seconds
            </span>
          </div>
        </div>

        {syncFeedback && (
          <div className="p-2.5 rounded-lg text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
            <span>{syncFeedback}</span>
            <button
              type="button"
              onClick={() => setSyncFeedback(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 text-sm leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Hostel Partition Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-500 mr-1">Partition by Hostel:</span>
          {(['all', 'BH1', 'GH', 'BH2'] as const).map((tab) => {
            const isActive = selectedEnrolledHostel === tab;
            const count = tab === 'all' ? enrolledCounts.all : (enrolledCounts as any)[tab];
            const label = tab === 'all' ? 'All Hostels' : tab === 'GH' ? "Girls' Hostel (GH)" : tab === 'BH1' ? "Boys' Hostel 1 (BH1)" : "Boys' Hostel 2 (BH2)";
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedEnrolledHostel(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filteredEnrolledUsers.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No enrolled user records found for the selected partition.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Hostel</th>
                  <th className="p-3">Machine User ID</th>
                  <th className="p-3">Student / Machine Name</th>
                  <th className="p-3">Academic Enrollment</th>
                  <th className="p-3">Allocated Room</th>
                  <th className="p-3">Privilege</th>
                  <th className="p-3">Fingerprint</th>
                  <th className="p-3">Registration Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredEnrolledUsers.map((user) => {
                  const hCode = user.hostelCode || (user.hostelId === '2' ? 'GH' : user.hostelId === '3' ? 'BH2' : 'BH1');
                  const badgeColor =
                    hCode === 'GH'
                      ? 'bg-rose-100 text-rose-800'
                      : hCode === 'BH2'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800';

                  return (
                    <tr
                      key={`${user.deviceSerial}-${user.userId}`}
                      className="border-t border-slate-100 hover:bg-slate-50/50"
                    >
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}>
                          {hCode}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1.5 font-mono">
                          {user.deviceName || user.deviceSerial}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {user.userId}
                      </td>
                      <td className="p-3">
                        <span className={`font-medium ${user.name ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                          {user.name || 'Name not fetched'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {user.enrollmentNo || '-'}
                      </td>
                      <td className="p-3">
                        {user.roomNumber ? `Room ${user.roomNumber} (${user.bedNumber || 'Bed -'})` : '-'}
                      </td>
                      <td className="p-3">
                        {user.privilege || 'User'}
                      </td>
                      <td className="p-3">
                        {user.fingerprintEnrolled
                          ? <span className="text-emerald-700 font-semibold">Yes ({user.fingerprintCount})</span>
                          : <span className="text-slate-400">Not confirmed</span>}
                      </td>
                      <td className="p-3">
                        {user.isRegistered ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Registered
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            New Machine ID
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-500">
          {/* Note: Fingerprint status machine ke enrollment metadata par based hai. Actual fingerprint template is screen par transfer ya display nahi kiya ja raha. */}
          Note: Fingerprint enrollment status reflects machine metadata. Raw biometric templates are securely retained on-device and never exposed in browser views.
        </p>
      </div>

      {/* Student Registration */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">

        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <UserPlus className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-sm text-slate-800">
            Student Registration
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setRegistrationMode('device');
              setOnboardFeedback(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${
              registrationMode === 'device'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Machine Linked Registration
          </button>

          <button
            type="button"
            onClick={() => {
              setRegistrationMode('manual');
              setSelectedMachineUserId('');
              setStudentForm((previous) => ({
                ...previous,
                biometricId: ''
              }));
              setOnboardFeedback(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${
              registrationMode === 'manual'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Manual Onboarding
          </button>
        </div>

        {registrationMode === 'device' ? (
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
            <p className="text-xs font-semibold text-indigo-900">
              Machine-linked registration
            </p>
            <p className="text-xs text-indigo-800 mt-1">
              {/* Machine se enrolled User ID select karein. Student details bharne ke baad registration pending verification mein jayega. */}
              Select an enrolled terminal User ID. Completing student details will register them into the institutional resident roster.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-900">
              Manual onboarding
            </p>
            <p className="text-xs text-amber-800 mt-1">
              {/* Existing manual onboarding process available hai. Is process mein existing backend ke mutabik student verified create hota hai. */}
              Standard manual onboarding workflow is active. Direct administrative entry bypasses terminal biometric pairing.
            </p>
          </div>
        )}

        {registrationMode === 'device' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Machine User ID
            </label>

            <select
              value={selectedMachineUserId}
              onChange={(event) =>
                handleMachineUserChange(event.target.value)
              }
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm"
              required
            >
              <option value="">Select enrolled machine user</option>

              {enrolledUsers
                .filter((user) => {
                  if (!studentForm.hostelId) return true;
                  return !user.hostelId || String(user.hostelId) === String(studentForm.hostelId);
                })
                .map((user) => (
                  <option key={`${user.deviceSerial}-${user.userId}`} value={user.userId}>
                    [{user.hostelCode || 'S362'}] ID #{user.userId} - {user.name || 'New Machine ID (Unlinked)'} {user.isRegistered ? '(Registered)' : '(New)'}
                  </option>
                ))}
            </select>

            {selectedMachineUser && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <p>
                    <strong>Machine User ID:</strong> {selectedMachineUser.userId}
                  </p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedMachineUser.isRegistered
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedMachineUser.isRegistered ? 'Registered Resident' : 'Unassigned Machine ID'}
                  </span>
                </div>
                <p>
                  <strong>Machine / Resident Name:</strong>{' '}
                  <span className="font-semibold text-slate-800">
                    {selectedMachineUser.name || 'Not available'}
                  </span>
                </p>
                <p>
                  <strong>Hostel Terminal:</strong>{' '}
                  <span className="font-medium text-indigo-700">
                    {selectedMachineUser.hostelName || selectedMachineUser.hostelCode || 'Hostel Terminal'} ({selectedMachineUser.deviceSerial})
                  </span>
                </p>
                <p>
                  <strong>Fingerprint Enrolled:</strong>{' '}
                  {selectedMachineUser.fingerprintEnrolled ? `Yes (${selectedMachineUser.fingerprintCount} template)` : 'Not confirmed'}
                </p>
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={
            registrationMode === 'device'
              ? handleDeviceRegistration
              : handleManualOnboard
          }
          className="space-y-4"
        >

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Enrollment Number
              </label>
              <input
                type="text"
                required
                value={studentForm.enrollmentNo}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    enrollmentNo: event.target.value
                  })
                }
                placeholder="e.g. 24BCSE101"
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Full Name
              </label>
              <input
                type="text"
                required
                value={studentForm.name}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    name: event.target.value
                  })
                }
                placeholder="Student name"
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course
              </label>
              <input
                type="text"
                required
                value={studentForm.course}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    course: event.target.value
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Semester
              </label>
              <input
                type="number"
                min="1"
                max="12"
                required
                value={studentForm.semester}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    semester: Number(event.target.value)
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gender
              </label>
              <select
                value={studentForm.gender}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    gender: event.target.value as StudentFormData['gender']
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Biometric Machine User ID
              </label>
              <input
                type="text"
                required
                readOnly={registrationMode === 'device'}
                value={studentForm.biometricId}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    biometricId: event.target.value
                  })
                }
                placeholder={
                  registrationMode === 'device'
                    ? 'Select machine user above'
                    : 'Enter biometric ID'
                }
                className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono read-only:bg-slate-100"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Hostel & Terminal
              </label>
              <select
                required
                value={studentForm.hostelId}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    hostelId: event.target.value
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="">Select Hostel</option>
                {hostels.map((hostel) => {
                  const mapped = devices.find((d: any) => String(d.hostelId) === String(hostel.id));
                  return (
                    <option key={hostel.id} value={hostel.id}>
                      {hostel.name} {mapped ? `(${mapped.hostelCode || 'S362'}: ${mapped.deviceSerial})` : ''}
                    </option>
                  );
                })}
              </select>
              {studentForm.hostelId && (
                <p className="text-[11px] text-indigo-600 mt-1 font-mono">
                  Mapped: {devices.find((d: any) => String(d.hostelId) === String(studentForm.hostelId))?.name || 'Assigned Terminal'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Block
              </label>
              <input
                type="text"
                required
                value={studentForm.block}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    block: event.target.value
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Room Number</span>
                {isLoadingRooms ? (
                  <span className="text-[10px] text-indigo-600 animate-pulse">Loading...</span>
                ) : studentForm.hostelId ? (
                  <span className="text-[10px] font-medium text-emerald-700">
                    {vacantRooms.length} vacant rooms
                  </span>
                ) : null}
              </label>
              <select
                required
                value={studentForm.roomNumber}
                onChange={(event) => handleRoomSelect(event.target.value)}
                disabled={isLoadingRooms || !studentForm.hostelId}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              >
                <option value="">
                  {isLoadingRooms
                    ? 'Loading rooms...'
                    : !studentForm.hostelId
                    ? 'Select hostel first'
                    : vacantRooms.length === 0
                    ? 'No vacant rooms available'
                    : 'Select Vacant Room'}
                </option>
                {studentForm.roomNumber && !vacantRooms.some((r) => r.roomNumber === studentForm.roomNumber) && (
                  <option value={studentForm.roomNumber}>
                    Room {studentForm.roomNumber} (Current Selection)
                  </option>
                )}
                {vacantRooms.map((r) => {
                  const bedsLeft = r.availableBeds ?? (r.capacity - r.currentOccupancy);
                  return (
                    <option key={r.id || r.roomNumber} value={r.roomNumber}>
                      Room {r.roomNumber} ({bedsLeft} of {r.capacity} beds vacant)
                    </option>
                  );
                })}
              </select>
            </div>

          </div>

          {/* Room & Bed Availability Status Indicator */}
          {currentRoom ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span>
                  <strong>Room {currentRoom.roomNumber} Availability:</strong>{' '}
                  <span className="text-emerald-700 font-semibold">
                    {currentRoom.availableBeds ?? (currentRoom.capacity - currentRoom.currentOccupancy)} of {currentRoom.capacity} beds vacant
                  </span>
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-300">
                  Vacant: {availableBedsForCurrentRoom.map((b) => `Bed ${b}`).join(', ') || 'None'}
                </span>
              </div>
              {currentRoom.occupants && currentRoom.occupants.length > 0 && (
                <div className="text-slate-600 text-[11px]">
                  Occupied: {currentRoom.occupants.map((o: any) => `${o.name} [Bed ${o.bedNumber || 'Assigned'}]`).join(', ')}
                </div>
              )}
            </div>
          ) : studentForm.hostelId && vacantRooms.length > 0 ? (
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 px-1">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>
                Showing <strong>{vacantRooms.length} vacant rooms</strong> for the selected hostel. Select a room to view and allocate vacant beds.
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Bed Number</span>
                {currentRoom && (
                  <span className="text-[10px] font-medium text-emerald-700">
                    {availableBedsForCurrentRoom.length} beds vacant
                  </span>
                )}
              </label>
              <select
                required
                value={studentForm.bedNumber}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    bedNumber: event.target.value
                  })
                }
                disabled={!studentForm.roomNumber || availableBedsForCurrentRoom.length === 0}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              >
                {!studentForm.roomNumber ? (
                  <option value="">First select a vacant room</option>
                ) : availableBedsForCurrentRoom.length === 0 ? (
                  <option value="">No vacant beds in Room {studentForm.roomNumber}</option>
                ) : (
                  <>
                    <option value="">Select Vacant Bed</option>
                    {availableBedsForCurrentRoom.map((bed) => (
                      <option key={bed} value={bed}>
                        Bed {bed} (Available)
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Phone
              </label>
              <input
                type="tel"
                required
                value={studentForm.studentPhone}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    studentPhone: event.target.value
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Email
              </label>
              <input
                type="email"
                required
                value={studentForm.studentEmail}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    studentEmail: event.target.value
                  })
                }
                placeholder="student@example.com"
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Parent Name
              </label>
              <input
                type="text"
                required
                value={studentForm.parentName}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    parentName: event.target.value
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Parent Phone
              </label>
              <input
                type="tel"
                required
                value={studentForm.parentPhone}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    parentPhone: event.target.value
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Parent Email
              </label>
              <input
                type="email"
                required
                value={studentForm.parentEmail}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    parentEmail: event.target.value
                  })
                }
                placeholder="parent@example.com"
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

          </div>

          {onboardFeedback && (
            <div className={`p-3 rounded-lg text-xs border ${
              onboardFeedback.toLowerCase().includes('successfully') ||
              onboardFeedback.toLowerCase().includes('verified')
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {onboardFeedback}
            </div>
          )}

          {lastCreatedCredentials && (
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wide text-indigo-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Generated Student Login Credentials
                </span>
                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">Ready to Login</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium mb-1">Student Portal Email:</span>
                  <code className="font-mono font-bold text-indigo-900 bg-white px-2.5 py-1.5 rounded-md border border-indigo-200 block text-xs">{lastCreatedCredentials.email}</code>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium mb-1">Default Password:</span>
                  <code className="font-mono font-bold text-emerald-700 bg-white px-2.5 py-1.5 rounded-md border border-indigo-200 block text-xs">{lastCreatedCredentials.password || 'student123'}</code>
                </div>
              </div>
              <p className="text-[11px] text-indigo-700">
                The student account has been created and activated. The resident can now log in directly from the login page.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={
              isSubmitting ||
              (registrationMode === 'device' && !selectedMachineUser)
            }
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : registrationMode === 'device' ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}

            {isSubmitting
              ? 'Submitting...'
              : registrationMode === 'device'
                ? 'Register & Verify Active Resident'
                : 'Onboard & Verify Student'}
          </button>

        </form>
      </div>

      {/* Live Punches */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Live Biometric Punch Records
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Real-time feed across terminals
          </span>
        </div>

        {/* Hostel Partition Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-500 mr-1">Partition by Hostel:</span>
          {(['all', 'BH1', 'GH', 'BH2'] as const).map((tab) => {
            const isActive = selectedLiveHostel === tab;
            const count = tab === 'all' ? liveCounts.all : (liveCounts as any)[tab];
            const label = tab === 'all' ? 'All Hostels' : tab === 'GH' ? "Girls' Hostel (GH)" : tab === 'BH1' ? "Boys' Hostel 1 (BH1)" : "Boys' Hostel 2 (BH2)";
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedLiveHostel(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {liveError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {liveError}
          </div>
        )}

        {!liveError && filteredLivePunches.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">
            No live punch records found for the selected partition.
          </div>
        )}

        {filteredLivePunches.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Biometric ID</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Hostel / Terminal</th>
                  <th className="p-3">Enrollment No</th>
                  <th className="p-3">Punch Time</th>
                  <th className="p-3">Recognition</th>
                </tr>
              </thead>

              <tbody>
                {filteredLivePunches.map((punch: any, index: number) => {
                  const hCode = punch.hostelCode || (punch.hostelId === '2' ? 'GH' : punch.hostelId === '3' ? 'BH2' : 'BH1');
                  const badgeColor = 
                    hCode === 'GH'
                      ? 'bg-rose-100 text-rose-800'
                      : hCode === 'BH2'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800';

                  return (
                    <tr
                      key={punch.id || index}
                      className="border-t border-slate-100"
                    >
                      <td className="p-3 font-mono">
                        {punch.biometricId || '-'}
                      </td>
                      <td className="p-3 font-medium text-slate-900">
                        {punch.studentName || 'Unrecognized'}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}>
                          {hCode}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1.5 font-mono">
                          {punch.deviceSerial || 'S362'}
                        </span>
                      </td>
                      <td className="p-3">
                        {punch.enrollmentNo || '-'}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {punch.punchTime || '-'}
                      </td>
                      <td className="p-3">
                        {punch.recognized ? (
                          <span className="text-emerald-600 font-semibold">
                            Recognized
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">
                            Not linked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* 6-Tier Absence Alert Escalation Hierarchy (FR-08) */}
      <SixTierAbsenceAlerts />

      {pageError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {pageError}
        </div>
      )}

    </div>
  );
};
