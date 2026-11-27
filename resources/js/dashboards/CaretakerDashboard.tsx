import React, { useState, useEffect } from 'react';
import {
  Cpu,
  UserPlus,
  CheckCircle2,
  RefreshCw,
  Database,
  Fingerprint,
  Users,
  Clock,
  ShieldCheck,
  Wifi,
  WifiOff,
  Key,
  Calendar,
  PlusCircle,
  Pencil,
  Edit3,
  FileText,
  AlertOctagon,
  UserCheck,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { AttendanceRecord, BiometricDevice, Hostel, LeaveRecord, Room, Student } from '../types';
import { HostelAttendanceBarChart } from '../components/dashboard/HostelAttendanceBarChart';
import { WarningTicketsTable } from '../components/dashboard/WarningTicketsTable';
import { DateQuickPresets } from '../components/dashboard/DateQuickPresets';

type SummaryCategory = 'residents' | 'present' | 'late' | 'leave' | 'follow-up';

interface EnrolledUser {
  userId: string;
  deviceSerial: string;
  deviceName?: string;
  name: string | null;
  hostelId?: string;
  hostelName?: string;
  hostelCode?: string;
  privilege: string | null;
  hasInfo: boolean;
  enrolledDate?: string | null;
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

const createInitialEnrollForm = (hostelId = ''): StudentFormData => ({
  enrollmentNo: '',
  name: '',
  course: 'B.Tech CSE',
  semester: 1,
  gender: 'male',
  hostelId,
  block: 'Block A',
  roomNumber: '',
  bedNumber: '',
  biometricId: '',
  studentEmail: '',
  studentPhone: '',
  parentName: '',
  parentEmail: '',
  parentPhone: ''
});

export const CaretakerDashboard: React.FC = () => {
  const { user } = useAuth();
  const assignedHostelId = String(user?.hostelId || '');

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [hostelRooms, setHostelRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [enrolledUsers, setEnrolledUsers] = useState<EnrolledUser[]>([]);
  const [liveData, setLiveData] = useState<any>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [defaulters, setDefaulters] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  const [attendanceDate, setAttendanceDate] = useState('');
  const [dateAttendance, setDateAttendance] = useState<AttendanceRecord[]>([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<SummaryCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingDevice, setIsSyncingDevice] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [enrolledDateFilter, setEnrolledDateFilter] = useState<string>('');
  const [showAllEnrolledUsers, setShowAllEnrolledUsers] = useState<boolean>(false);
  const [liveDateFilter, setLiveDateFilter] = useState<string>('');
  const [showAllLivePunches, setShowAllLivePunches] = useState<boolean>(false);

  const filteredEnrolledUsers = React.useMemo(() => {
    if (!enrolledDateFilter) return enrolledUsers;
    return enrolledUsers.filter((u) => u.enrolledDate === enrolledDateFilter);
  }, [enrolledUsers, enrolledDateFilter]);

  const visibleEnrolledUsers = React.useMemo(() => {
    return showAllEnrolledUsers ? filteredEnrolledUsers : filteredEnrolledUsers.slice(0, 10);
  }, [filteredEnrolledUsers, showAllEnrolledUsers]);

  const livePunches: any[] = Array.isArray(liveData?.punches) ? liveData.punches : [];

  const filteredLivePunches = React.useMemo(() => {
    if (!liveDateFilter) return livePunches;
    return livePunches.filter((p: any) => String(p.punchTime || '').slice(0, 10) === liveDateFilter);
  }, [livePunches, liveDateFilter]);

  const visibleLivePunches = React.useMemo(() => {
    return showAllLivePunches ? filteredLivePunches : filteredLivePunches.slice(0, 10);
  }, [filteredLivePunches, showAllLivePunches]);

  // Enrollment state (same full form as Biometric Device Manager, locked to assigned hostel)
  const [registrationMode, setRegistrationMode] = useState<'device' | 'manual'>('device');
  const [selectedMachineUserId, setSelectedMachineUserId] = useState('');
  const [studentForm, setStudentForm] = useState<StudentFormData>(createInitialEnrollForm(assignedHostelId));
  const [isSubmittingEnroll, setIsSubmittingEnroll] = useState(false);
  const [enrollFeedback, setEnrollFeedback] = useState<string | null>(null);
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState<{
    name: string;
    email: string;
    password?: string;
    enrollmentNo?: string;
  } | null>(null);

  // Edit Student Modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    studentEmail: '',
    enrollmentNo: '',
    course: '',
    roomNumber: '',
    bedNumber: 'A',
    biometricId: '',
    parentName: '',
    parentEmail: ''
  });
  const [editFeedback, setEditFeedback] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Assign Leave Modal (Caretaker assigns -> Warden approves)
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [leaveForm, setLeaveForm] = useState({
    studentId: '',
    startDate: todayIst,
    endDate: todayIst,
    reason: '',
    gatePassNo: `GP-${Date.now().toString().slice(-4)}`,
    parentConsentVerified: true,
    notes: ''
  });
  const [leaveFeedback, setLeaveFeedback] = useState<string | null>(null);

  // Attendance Correction Modal (Warden feature)
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRecord | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<string>('present');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [correctionMsg, setCorrectionMsg] = useState<string | null>(null);

  const [studentSearch, setStudentSearch] = useState('');

  const assignedHostel = hostels.find((h) => String(h.id) === assignedHostelId) || hostels[0];
  const assignedDevice: any = devices[0] || null;
  const activeDeviceSerial = assignedDevice?.deviceSerial || assignedDevice?.deviceId || 'RSS20241199684';
  const mongoConnected = liveData?.mongo?.connected === true;
  const deviceOnline = Boolean(assignedDevice && (assignedDevice.isOnline === true || assignedDevice.status === 'online_synced'));
  const heartbeatSeconds = assignedDevice?.heartbeatSecondsAgo;

  const loadRoomsForHostel = async (hostelId: string) => {
    if (!hostelId) {
      setHostelRooms([]);
      return;
    }
    setIsLoadingRooms(true);
    try {
      const rRes = await apiService.getHostelRooms(hostelId);
      setHostelRooms(rRes.success && Array.isArray(rRes.rooms) ? rRes.rooms : []);
    } catch {
      setHostelRooms([]);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      apiService.triggerBiometricUserFetch(activeDeviceSerial).catch(() => {});

      const [hRes, dRes, eRes, sRes, attRes, defRes, lvRes] = await Promise.all([
        apiService.getHostels(),
        apiService.getBiometricDevices(),
        apiService.getBiometricEnrolledUsers(),
        apiService.getStudents(),
        apiService.getTodayAttendance(),
        apiService.getDefaulters(),
        apiService.getLeaves()
      ]);

      try {
        const lRes = await apiService.getLiveBiometricPunches();
        setLiveData(lRes);
        setLiveError(null);
      } catch (err: any) {
        setLiveError(err.response?.data?.message || 'Failed to load live biometric punches.');
      }

      if (hRes.success) {
        setHostels(hRes.hostels);
        const hId = assignedHostelId || hRes.hostels[0]?.id || '';
        if (hId) {
          setStudentForm((prev) => ({ ...prev, hostelId: String(hId) }));
          await loadRoomsForHostel(String(hId));
        }
      }
      if (dRes.success) setDevices(dRes.devices);
      if (eRes.success) setEnrolledUsers(eRes.users || []);
      if (sRes.success) setStudents(sRes.students);
      if (attRes.success) setAttendanceDate((prev) => prev || attRes.date);
      if (defRes.success) setDefaulters(defRes.defaulters);
      if (lvRes.success) setLeaves(lvRes.leaves);
    } catch (err) {
      console.error('Caretaker dashboard load failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const timer = window.setInterval(() => {
      apiService.getBiometricDevices().then((r) => r.success && setDevices(r.devices)).catch(() => {});
      apiService.getBiometricEnrolledUsers().then((r) => r.success && setEnrolledUsers(r.users || [])).catch(() => {});
      apiService.getLiveBiometricPunches().then((r) => { setLiveData(r); setLiveError(null); }).catch(() => {});
      apiService.getLeaves().then((r) => r.success && setLeaves(r.leaves)).catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!attendanceDate) return;
    let isCurrent = true;
    const fetchDateAttendance = (showSpinner: boolean) => {
      if (showSpinner) setIsSummaryLoading(true);
      setSummaryError(null);
      Promise.all([
        apiService.getAttendanceHistory({ startDate: attendanceDate, endDate: attendanceDate }),
        apiService.getDefaulters(attendanceDate, assignedHostelId || undefined)
      ])
        .then(([histRes, defRes]) => {
          if (!isCurrent) return;
          if (histRes.success) setDateAttendance(histRes.records);
          if (defRes.success) setDefaulters(defRes.defaulters);
        })
        .catch(() => {
          if (isCurrent && showSpinner) {
            setDateAttendance([]);
            setSummaryError('Unable to load attendance records for this date.');
          }
        })
        .finally(() => {
          if (isCurrent && showSpinner) setIsSummaryLoading(false);
        });
    };

    fetchDateAttendance(true);
    const summaryTimer = window.setInterval(() => fetchDateAttendance(false), 5000);

    return () => {
      isCurrent = false;
      window.clearInterval(summaryTimer);
    };
  }, [attendanceDate, assignedHostelId, user]);

  const handleSyncFromMachine = async () => {
    setIsSyncingDevice(true);
    setSyncFeedback(`Fetch command dispatched to ${activeDeviceSerial}... refreshing in 6 seconds.`);
    try {
      await apiService.triggerBiometricUserFetch(activeDeviceSerial);
      window.setTimeout(async () => {
        const eRes = await apiService.getBiometricEnrolledUsers();
        if (eRes.success) setEnrolledUsers(eRes.users || []);
      }, 3500);

      window.setTimeout(async () => {
        const [eRes, lRes] = await Promise.all([
          apiService.getBiometricEnrolledUsers(),
          apiService.getLiveBiometricPunches().catch(() => null),
        ]);
        if (eRes.success) setEnrolledUsers(eRes.users || []);
        if (lRes) setLiveData(lRes);
        setIsSyncingDevice(false);
        setSyncFeedback('Assigned hostel terminal enrollments synchronized.');
        window.setTimeout(() => setSyncFeedback(null), 4000);
      }, 7000);
    } catch (err: any) {
      setIsSyncingDevice(false);
      setSyncFeedback(err.response?.data?.message || 'Failed to sync assigned terminal.');
    }
  };

  const vacantRooms = hostelRooms.filter((r) => {
    if (typeof r.availableBeds === 'number') return r.availableBeds > 0;
    if (typeof r.capacity === 'number' && typeof r.currentOccupancy === 'number') return r.currentOccupancy < r.capacity;
    return !r.isFull;
  });

  const currentRoom = hostelRooms.find((r) => String(r.roomNumber) === String(studentForm.roomNumber));
  const availableBedsForCurrentRoom = React.useMemo(() => {
    if (!currentRoom) return [];
    if (Array.isArray(currentRoom.vacantBeds) && currentRoom.vacantBeds.length > 0) return currentRoom.vacantBeds;
    const cap = currentRoom.capacity || 3;
    const allBeds = ['A', 'B', 'C', 'D'].slice(0, cap);
    const occupied = (currentRoom.occupants || []).map((o: any) => String(o.bedNumber || o.bed || '').toUpperCase().trim());
    return allBeds.filter((b) => !occupied.includes(b));
  }, [currentRoom]);

  const handleRoomSelect = (roomNum: string) => {
    const selected = hostelRooms.find((r) => String(r.roomNumber) === String(roomNum));
    const vacantList = selected?.vacantBeds && selected.vacantBeds.length > 0 ? selected.vacantBeds : ['A', 'B', 'C'];
    setStudentForm((prev) => ({
      ...prev,
      roomNumber: roomNum,
      bedNumber: vacantList[0] || 'A',
      block: selected?.block || prev.block || 'Block A'
    }));
  };

  const selectedMachineUser = enrolledUsers.find((u) => u.userId === selectedMachineUserId);

  const handleSelectMachineUser = (userId: string) => {
    setSelectedMachineUserId(userId);
    setEnrollFeedback(null);
    setLastCreatedCredentials(null);
    const mUser = enrolledUsers.find((u) => u.userId === userId);
    if (!mUser) {
      setStudentForm((prev) => ({ ...prev, biometricId: '' }));
      return;
    }

    const cleanName = (mUser.name || '').trim();
    const slug = cleanName ? cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.') : `resident${mUser.userId}`;
    const roomToSet = mUser.roomNumber || studentForm.roomNumber || vacantRooms[0]?.roomNumber || '';
    const matchedRoom = hostelRooms.find((r) => String(r.roomNumber) === String(roomToSet));

    setStudentForm((prev) => ({
      ...prev,
      hostelId: assignedHostelId || prev.hostelId,
      biometricId: mUser.userId,
      name: cleanName || prev.name || `Resident ${mUser.userId}`,
      enrollmentNo: mUser.enrollmentNo || `2024BIO${String(mUser.userId).padStart(3, '0')}`,
      studentEmail: `${slug}@student.edu.in`,
      roomNumber: roomToSet,
      bedNumber: mUser.bedNumber || matchedRoom?.vacantBeds?.[0] || 'A',
      block: matchedRoom?.block || prev.block || 'Block A'
    }));
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollFeedback(null);
    setLastCreatedCredentials(null);
    setIsSubmittingEnroll(true);

    try {
      const targetHostelId = assignedHostelId || studentForm.hostelId;
      if (registrationMode === 'device') {
        if (!selectedMachineUser) {
          setEnrollFeedback('Select a machine user from your hostel terminal first.');
          setIsSubmittingEnroll(false);
          return;
        }
        const res: any = await apiService.submitDeviceStudentRegistration({
          ...studentForm,
          hostelId: targetHostelId,
          biometricId: selectedMachineUser.userId,
          deviceSerial: activeDeviceSerial
        });
        if (res.success) {
          setLastCreatedCredentials(res.credentials || { name: studentForm.name, email: studentForm.studentEmail, password: 'student123', enrollmentNo: studentForm.enrollmentNo });
          setEnrollFeedback('Student enrolled and linked to your hostel terminal.');
          setSelectedMachineUserId('');
          setStudentForm(createInitialEnrollForm(targetHostelId));
          await loadAll();
        } else {
          setEnrollFeedback(res.message || 'Student registration failed.');
        }
      } else {
        if (!studentForm.biometricId.trim()) {
          setEnrollFeedback('Please enter a Biometric ID for manual onboarding.');
          setIsSubmittingEnroll(false);
          return;
        }
        const res: any = await apiService.onboardStudent({ ...studentForm, hostelId: targetHostelId });
        if (res.success) {
          setLastCreatedCredentials(res.credentials || { name: studentForm.name, email: studentForm.studentEmail, password: 'student123', enrollmentNo: studentForm.enrollmentNo });
          setEnrollFeedback(`Student ${studentForm.name} onboarded into your hostel successfully.`);
          setStudentForm(createInitialEnrollForm(targetHostelId));
          await loadAll();
        } else {
          setEnrollFeedback(res.message || 'Student onboarding failed.');
        }
      }
    } catch (err: any) {
      setEnrollFeedback(err.response?.data?.message || 'Student enrollment failed.');
    } finally {
      setIsSubmittingEnroll(false);
    }
  };

  const handleOpenEdit = (s: Student) => {
    setEditingStudent(s);
    setEditFeedback(null);
    setEditForm({
      name: s.name || '',
      studentEmail: s.studentEmail || '',
      enrollmentNo: s.enrollmentNo || '',
      course: s.course || '',
      roomNumber: s.roomNumber || '',
      bedNumber: s.bedNumber || 'A',
      biometricId: s.biometricId || '',
      parentName: s.parentName || '',
      parentEmail: s.parentEmail || ''
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsSavingEdit(true);
    setEditFeedback(null);
    try {
      const res = await apiService.updateStudent(editingStudent.id, {
        ...editForm,
        hostelId: assignedHostelId || editingStudent.hostelId
      });
      if (res.success) {
        setEditingStudent(null);
        await loadAll();
      }
    } catch (err: any) {
      setEditFeedback(err.response?.data?.message || 'Failed to update student.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleVerifyStudent = async (studentId: string, action: 'approve' | 'reject') => {
    try {
      const res = await apiService.verifyStudentRegistration(studentId, action);
      if (res.success) await loadAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveFeedback(null);
    try {
      const res = await apiService.enterLeave(leaveForm);
      if (res.success) {
        setLeaveFeedback(res.message || 'Leave assigned (Pending Warden approval).');
        window.setTimeout(() => {
          setIsLeaveModalOpen(false);
          setLeaveFeedback(null);
          setLeaveForm((f) => ({ ...f, studentId: '', reason: '' }));
          loadAll();
        }, 1200);
      }
    } catch (err: any) {
      setLeaveFeedback(err.response?.data?.message || 'Failed to assign leave.');
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTarget) return;
    try {
      const res = await apiService.correctAttendance(correctionTarget.id, correctionStatus, correctionReason);
      if (res.success) {
        setCorrectionMsg('Attendance updated and audit log recorded.');
        window.setTimeout(() => {
          setCorrectionTarget(null);
          setCorrectionMsg(null);
          setCorrectionReason('');
          loadAll();
        }, 900);
      }
    } catch (err: any) {
      setCorrectionMsg(err.response?.data?.message || 'Correction failed.');
    }
  };

  const activeResidents = students.filter((s) => s.verificationStatus === 'verified');
  const pendingStudents = students.filter((s) => s.verificationStatus === 'pending_verification');
  const presentRecords = dateAttendance.filter((r) => r.status === 'present');
  const lateRecords = dateAttendance.filter((r) => r.status === 'late');
  const leaveRecords = dateAttendance.filter((r) => r.status === 'approved_leave');
  const followUpRecords = dateAttendance.filter((r) => r.isDefaulter || r.status === 'absent');

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.enrollmentNo.toLowerCase().includes(q) || s.roomNumber.toLowerCase().includes(q) || s.biometricId.toLowerCase().includes(q);
  });

  const selectedRecords = selectedSummary === 'present'
    ? presentRecords
    : selectedSummary === 'late'
      ? lateRecords
      : selectedSummary === 'leave'
        ? leaveRecords
        : selectedSummary === 'follow-up'
          ? followUpRecords
          : [];

  return (
    <div className="space-y-6">
      {/* Hostel-Scoped Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              Hostel Caretaker Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
              {assignedHostel ? `${assignedHostel.name} (${assignedHostel.code})` : `Hostel #${assignedHostelId}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hostel biometric device status, machine enrollment, student CRUD, attendance oversight, and leave assignment for your assigned hostel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLeaveModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Assign Leave (Warden Approval)</span>
          </button>
          <button
            type="button"
            onClick={loadAll}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* 4 Live Biometric & Connection Status Cards (Scoped to Assigned Hostel) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`bg-white rounded-xl border p-5 transition-all ${deviceOnline ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 bg-rose-50/20'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${deviceOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <p className="text-xs text-slate-500 font-semibold">
                  Hostel Machine ({assignedHostel?.code || 'S362'})
                </p>
              </div>
              <p className={`text-lg font-bold mt-2 ${deviceOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
                {deviceOnline ? 'Connected (Live)' : 'Not Connected'}
              </p>
            </div>
            {deviceOnline ? <Wifi className="w-8 h-8 text-emerald-500" /> : <WifiOff className="w-8 h-8 text-rose-500" />}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {deviceOnline
              ? `Live heartbeat active (~${heartbeatSeconds ?? 3}s ago)`
              : `Serial ${activeDeviceSerial} standby / offline`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">Database (MongoDB)</p>
              <p className={`text-lg font-bold mt-2 ${mongoConnected ? 'text-emerald-600' : 'text-rose-600'}`}>
                {mongoConnected ? 'Connected (Local)' : 'Not Connected'}
              </p>
            </div>
            <Database className={`w-8 h-8 ${mongoConnected ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <p className="text-xs text-slate-400 mt-2">biometric_db (Port 27017)</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">Machine Enrolled Users</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{enrolledUsers.length}</p>
            </div>
            <Users className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-xs text-slate-400 mt-2">Users on {assignedHostel?.code || 'hostel'} terminal</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">Hostel Punch Records</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{livePunches.length}</p>
            </div>
            <Clock className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-xs text-slate-400 mt-2">Live punches for {assignedHostel?.code || 'your hostel'}</p>
        </div>
      </div>

      {/* Assigned Hostel Biometric Terminal Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Assigned Hostel Biometric Terminal
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {assignedHostel?.name || 'Assigned Hostel'} Only
          </span>
        </div>

        {assignedDevice ? (
          <div className={`p-4 rounded-xl border transition-all ${deviceOnline ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/40'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{assignedDevice.name || assignedDevice.deviceName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assigned: <strong className="text-slate-700">{assignedDevice.hostelName}</strong> • Model: <span className="font-mono font-semibold text-slate-800">{assignedDevice.modelNo || 'S362'}</span> • Serial: <span className="font-mono font-semibold text-slate-800">{activeDeviceSerial}</span> • IP: <span className="font-mono">{assignedDevice.ipAddress}</span>
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${deviceOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                <span className={`w-2 h-2 rounded-full ${deviceOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {deviceOnline ? 'Device Connected (Live)' : 'Device Disconnected / Standby'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">No biometric terminal mapped to your hostel yet.</div>
        )}
      </div>

      {/* Actual Machine Enrolled Users (Hostel Scoped) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2 className="font-bold text-sm text-slate-800">
              Actual Machine Enrolled Users ({assignedHostel?.code || 'Assigned Hostel'})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <label htmlFor="caretaker-enrolled-date-filter" className="text-slate-600 font-medium whitespace-nowrap">
                Enroll Date:
              </label>
              <input
                id="caretaker-enrolled-date-filter"
                type="date"
                value={enrolledDateFilter}
                onChange={(e) => {
                  setEnrolledDateFilter(e.target.value);
                  setShowAllEnrolledUsers(false);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
              />
              <DateQuickPresets
                value={enrolledDateFilter}
                onChange={(date) => {
                  setEnrolledDateFilter(date);
                  setShowAllEnrolledUsers(false);
                }}
                allowAll
                tone="indigo"
              />
            </div>

            <button
              type="button"
              onClick={handleSyncFromMachine}
              disabled={isSyncingDevice}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDevice ? 'animate-spin' : ''}`} />
              <span>{isSyncingDevice ? 'Syncing Machine...' : 'Pull Latest from Machine'}</span>
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div className="p-2.5 rounded-lg text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
            <span>{syncFeedback}</span>
            <button type="button" onClick={() => setSyncFeedback(null)} className="font-bold ml-2">×</button>
          </div>
        )}

        {filteredEnrolledUsers.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            {enrolledDateFilter
              ? `No machine user records found on ${enrolledDateFilter} for your hostel.`
              : 'No machine user records found for your hostel.'}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
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
                  {visibleEnrolledUsers.map((u) => (
                    <tr key={`${u.deviceSerial}-${u.userId}`} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-900">{u.userId}</td>
                      <td className="p-3">
                        <span className={`font-medium ${u.name ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                          {u.name || 'Name not fetched'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{u.enrollmentNo || '-'}</td>
                      <td className="p-3">{u.roomNumber ? `Room ${u.roomNumber} (${u.bedNumber || 'A'})` : '-'}</td>
                      <td className="p-3">{u.privilege || 'User'}</td>
                      <td className="p-3">
                        {u.fingerprintEnrolled ? <span className="text-emerald-700 font-semibold">Yes ({u.fingerprintCount})</span> : <span className="text-slate-400">Not confirmed</span>}
                      </td>
                      <td className="p-3">
                        {u.isRegistered ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Registered
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setRegistrationMode('device');
                              handleSelectMachineUser(u.userId);
                              document.getElementById('caretaker-enroll-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer"
                          >
                            <span>New Machine ID</span>
                            <span className="underline">Enroll →</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredEnrolledUsers.length > 10 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500">
                  Showing <strong className="text-slate-800">{visibleEnrolledUsers.length}</strong> of{' '}
                  <strong className="text-slate-800">{filteredEnrolledUsers.length}</strong> enrolled users
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllEnrolledUsers((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition cursor-pointer"
                >
                  {showAllEnrolledUsers ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Show Less</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>View More ({filteredEnrolledUsers.length - 10} more)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Student Registration Form (Same as Mehra Ji's, Scoped to Assigned Hostel) */}
      <div id="caretaker-enroll-form" className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Student Registration ({assignedHostel?.name || 'Assigned Hostel'})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRegistrationMode('device');
                setEnrollFeedback(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                registrationMode === 'device' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              From Biometric Machine
            </button>
            <button
              type="button"
              onClick={() => {
                setRegistrationMode('manual');
                setSelectedMachineUserId('');
                setEnrollFeedback(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                registrationMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Manual Entry
            </button>
          </div>
        </div>

        {registrationMode === 'device' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Machine User ID</label>
            <select
              value={selectedMachineUserId}
              onChange={(e) => handleSelectMachineUser(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm"
              required
            >
              <option value="">Select enrolled machine user</option>
              {enrolledUsers.map((u) => (
                <option key={`${u.deviceSerial}-${u.userId}`} value={u.userId}>
                  [{u.hostelCode || assignedHostel?.code || 'S362'}] ID #{u.userId} - {u.name || 'New Machine ID (Unlinked)'} {u.isRegistered ? '(Registered)' : '(New)'}
                </option>
              ))}
            </select>

            {selectedMachineUser && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p><strong>Machine User ID:</strong> {selectedMachineUser.userId}</p>
                <p><strong>Machine / Resident Name:</strong> {selectedMachineUser.name || 'Not available'}</p>
                <p><strong>Fingerprint Enrolled:</strong> {selectedMachineUser.fingerprintEnrolled ? `Yes (${selectedMachineUser.fingerprintCount} template)` : 'Not confirmed'}</p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleEnrollSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Enrollment Number</label>
              <input type="text" required value={studentForm.enrollmentNo} onChange={(e) => setStudentForm({ ...studentForm, enrollmentNo: e.target.value })} placeholder="e.g. 24BCSE101" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name</label>
              <input type="text" required value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} placeholder="Student name" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Course</label>
              <input type="text" required value={studentForm.course} onChange={(e) => setStudentForm({ ...studentForm, course: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
              <input type="number" min="1" max="12" required value={studentForm.semester} onChange={(e) => setStudentForm({ ...studentForm, semester: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
              <select value={studentForm.gender} onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as StudentFormData['gender'] })} className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Biometric Machine User ID</label>
              <input type="text" required readOnly={registrationMode === 'device'} value={studentForm.biometricId} onChange={(e) => setStudentForm({ ...studentForm, biometricId: e.target.value })} placeholder={registrationMode === 'device' ? 'Select machine user above' : 'Enter biometric ID'} className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono read-only:bg-slate-100" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Hostel & Terminal</label>
              <select required disabled value={studentForm.hostelId} onChange={() => {}} className="w-full p-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-700 text-sm">
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>{h.name} ({h.code}: {activeDeviceSerial})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Block</label>
              <input type="text" required value={studentForm.block} onChange={(e) => setStudentForm({ ...studentForm, block: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Room Number</span>
                {isLoadingRooms ? <span className="text-[10px] text-indigo-600">Loading...</span> : <span className="text-[10px] text-emerald-700">{vacantRooms.length} vacant rooms</span>}
              </label>
              <select required value={studentForm.roomNumber} onChange={(e) => handleRoomSelect(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm">
                <option value="">Select Vacant Room</option>
                {vacantRooms.map((r) => {
                  const bedsLeft = r.availableBeds ?? (r.capacity - r.currentOccupancy);
                  return <option key={r.id || r.roomNumber} value={r.roomNumber}>Room {r.roomNumber} ({bedsLeft} of {r.capacity} beds vacant)</option>;
                })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bed Number</label>
              <select required value={studentForm.bedNumber} onChange={(e) => setStudentForm({ ...studentForm, bedNumber: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm">
                <option value="">Select Vacant Bed</option>
                {availableBedsForCurrentRoom.map((bed) => <option key={bed} value={bed}>Bed {bed} (Available)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Student Phone</label>
              <input type="tel" required value={studentForm.studentPhone} onChange={(e) => setStudentForm({ ...studentForm, studentPhone: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Student Email</label>
              <input type="email" required value={studentForm.studentEmail} onChange={(e) => setStudentForm({ ...studentForm, studentEmail: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Parent / Guardian Name</label>
              <input type="text" required value={studentForm.parentName} onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Email</label>
              <input type="email" required value={studentForm.parentEmail} onChange={(e) => setStudentForm({ ...studentForm, parentEmail: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Phone</label>
              <input type="tel" required value={studentForm.parentPhone} onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          {enrollFeedback && (
            <div className="p-3 rounded-lg text-xs bg-indigo-50 border border-indigo-200 text-indigo-900">
              {enrollFeedback}
            </div>
          )}

          {lastCreatedCredentials && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <Key className="w-4 h-4 text-emerald-700" />
                <span>Generated Student Login Credentials ({lastCreatedCredentials.name})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>Login Email: <code className="font-mono font-bold text-emerald-900">{lastCreatedCredentials.email}</code></div>
                <div>Default Password: <code className="font-mono font-bold text-emerald-900">{lastCreatedCredentials.password || 'student123'}</code></div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmittingEnroll || (registrationMode === 'device' && !selectedMachineUser)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isSubmittingEnroll ? 'Submitting...' : registrationMode === 'device' ? 'Register & Verify Active Resident' : 'Onboard & Verify Student'}</span>
          </button>
        </form>
      </div>

      {/* Live Biometric Punches (Assigned Hostel Only) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2 className="font-bold text-sm text-slate-800">Live Biometric Punch Records ({assignedHostel?.code || 'Assigned Hostel'})</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <label htmlFor="caretaker-live-date-filter" className="text-slate-600 font-medium whitespace-nowrap">
                Punch Date:
              </label>
              <input
                id="caretaker-live-date-filter"
                type="date"
                value={liveDateFilter}
                onChange={(e) => {
                  setLiveDateFilter(e.target.value);
                  setShowAllLivePunches(false);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
              />
              <DateQuickPresets
                value={liveDateFilter}
                onChange={(date) => {
                  setLiveDateFilter(date);
                  setShowAllLivePunches(false);
                }}
                allowAll
                tone="indigo"
              />
            </div>

            <span className="text-xs text-slate-500 hidden sm:inline">Real-time feed for your hostel terminal</span>
          </div>
        </div>

        {liveError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">{liveError}</div>}

        {filteredLivePunches.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            {liveDateFilter
              ? `No live punches recorded on ${liveDateFilter} for this hostel.`
              : 'No live punches recorded for this hostel yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">Biometric ID</th>
                    <th className="p-3">Student</th>
                    <th className="p-3">Enrollment No</th>
                    <th className="p-3">Punch Time</th>
                    <th className="p-3">Recognition</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLivePunches.map((p: any) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="p-3 font-mono font-bold">{p.biometricId}</td>
                      <td className="p-3 font-medium">{p.studentName || 'Unrecognized'}</td>
                      <td className="p-3 font-mono">{p.enrollmentNo || '-'}</td>
                      <td className="p-3 font-mono">{p.punchTime || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${p.recognized ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {p.recognized ? 'Recognized' : 'Not linked'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredLivePunches.length > 10 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500">
                  Showing <strong className="text-slate-800">{visibleLivePunches.length}</strong> of{' '}
                  <strong className="text-slate-800">{filteredLivePunches.length}</strong> punch records
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllLivePunches((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition cursor-pointer"
                >
                  {showAllLivePunches ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Show Less</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>View More ({filteredLivePunches.length - 10} more)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Residential Warden Features: Attendance Summary & Bar Chart */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800">Hostel Attendance Summary (Warden Controls)</h2>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <span>Attendance date</span>
            <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="rounded border border-slate-300 px-2 py-0.5 font-mono text-xs" />
            <DateQuickPresets value={attendanceDate} onChange={setAttendanceDate} tone="indigo" />
          </div>
        </div>

        {summaryError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{summaryError}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {([
            { key: 'residents', label: 'Residents', value: activeResidents.length, color: 'text-slate-900' },
            { key: 'present', label: 'Present', value: presentRecords.length, color: 'text-emerald-600' },
            { key: 'late', label: 'Late arrivals', value: lateRecords.length, color: 'text-amber-600' },
            { key: 'leave', label: 'On approved leave', value: leaveRecords.length, color: 'text-blue-600' },
            { key: 'follow-up', label: 'Needs follow-up', value: followUpRecords.length, color: 'text-rose-600' }
          ] as const).map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => setSelectedSummary(card.key)}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-indigo-300 transition"
            >
              <div className="text-xs font-semibold uppercase text-slate-500">{card.label}</div>
              <div className={`mt-1 text-2xl font-bold ${card.color}`}>
                {card.key !== 'residents' && isSummaryLoading ? '…' : card.value}
              </div>
              <div className="mt-1 text-[10px] font-semibold text-indigo-600">Click to view / correct</div>
            </button>
          ))}
        </div>

        <HostelAttendanceBarChart
          currentDate={attendanceDate || '2026-11-26'}
          hostelId={assignedHostelId || '1'}
          allowHostelSwitch={false}
        />
      </div>

      {/* Defaulters Follow-Up (Warden Feature) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 bg-rose-50/60 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-rose-600" />
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Students to Follow Up</h2>
              <p className="text-[11px] text-rose-700">Assigned hostel residents who have not checked in after evening cutoff.</p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-rose-600 text-white px-2.5 py-1 rounded-md">{defaulters.length} students</span>
        </div>

        {defaulters.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">Everyone in this hostel is accounted for or on approved leave today.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Enrollment No</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {defaulters.map((d) => (
                  <tr key={d.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900">{d.studentName}</td>
                    <td className="py-3 px-4 font-mono">{d.enrollmentNo}</td>
                    <td className="py-3 px-4">Room {d.roomNumber}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => { setCorrectionTarget(d); setCorrectionStatus('present'); setCorrectionReason(''); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Update attendance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Registration Verification Queue (Warden Feature) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <h2 className="font-bold text-slate-800 text-sm">Registration Verification Requests</h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{pendingStudents.length} awaiting review</span>
        </div>

        {pendingStudents.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-xs">No pending registrations in this hostel.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Enrollment No</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-3 font-semibold">{s.name}</td>
                    <td className="py-2.5 px-3 font-mono">{s.enrollmentNo}</td>
                    <td className="py-2.5 px-3">Room {s.roomNumber}</td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button type="button" onClick={() => handleVerifyStudent(s.id, 'approve')} className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold cursor-pointer">Verify</button>
                      <button type="button" onClick={() => handleVerifyStudent(s.id, 'reject')} className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded text-[11px] font-semibold cursor-pointer">Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hostel Students Directory & Inline Edit */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-800">Hostel Students Directory &amp; Edit ({students.length})</h2>
          </div>
          <input
            type="text"
            placeholder="Search name, enrollment, room, bio ID..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="p-2 text-xs border border-slate-300 rounded-lg w-full sm:w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2.5">Name & Email</th>
                <th className="p-2.5">Enrollment</th>
                <th className="p-2.5">Bio ID</th>
                <th className="p-2.5">Room / Bed</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="p-2.5">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-[11px] text-slate-400">{s.studentEmail}</div>
                  </td>
                  <td className="p-2.5 font-mono">{s.enrollmentNo}</td>
                  <td className="p-2.5 font-mono">{s.biometricId}</td>
                  <td className="p-2.5">Room {s.roomNumber} ({s.bedNumber || 'A'})</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {s.verificationStatus}
                    </span>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(s)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leaves Assigned / Pending Warden Approval */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-800">Hostel Leave Records (Assign Only — Warden Approves)</h2>
          </div>
          <span className="text-[11px] text-amber-700 font-medium">Caretakers assign leaves; Wardens approve them</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2.5">Gate Pass</th>
                <th className="p-2.5">Student</th>
                <th className="p-2.5">Dates</th>
                <th className="p-2.5">Reason</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-slate-400">No leave records for this hostel.</td></tr>
              ) : leaves.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="p-2.5 font-mono font-semibold">{l.gatePassNo}</td>
                  <td className="p-2.5">{l.studentName} ({l.enrollmentNo})</td>
                  <td className="p-2.5">{l.startDate} to {l.endDate}</td>
                  <td className="p-2.5">{l.reason}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      l.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : l.status === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {l.status === 'Pending' ? 'Pending Warden Approval' : l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <WarningTicketsTable hostelId={assignedHostelId || '1'} role="caretaker" />

      {/* Summary Records + Attendance Correction Modal */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 capitalize">{selectedSummary} Records ({attendanceDate})</h3>
              <button type="button" onClick={() => setSelectedSummary(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-2.5">Student</th>
                  <th className="p-2.5">Room</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(selectedSummary === 'residents' ? activeResidents : selectedRecords).map((r: any) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-2.5 font-medium">{r.studentName || r.name}</td>
                    <td className="p-2.5">{r.roomNumber || '-'}</td>
                    <td className="p-2.5">{r.status || r.verificationStatus}</td>
                    <td className="p-2.5 text-right">
                      {selectedSummary !== 'residents' && (
                        <button
                          type="button"
                          onClick={() => { setCorrectionTarget(r); setCorrectionStatus(r.status); }}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[11px] font-semibold cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Correct
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance Correction Modal */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4">
          <form onSubmit={handleCorrectionSubmit} className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900">Correct Attendance ({correctionTarget.studentName})</h3>
            {correctionMsg && <div className="p-2 bg-emerald-50 text-emerald-800 rounded">{correctionMsg}</div>}
            <select value={correctionStatus} onChange={(e) => setCorrectionStatus(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="approved_leave">Approved Leave</option>
              <option value="absent">Absent</option>
            </select>
            <textarea required placeholder="Reason for correction..." value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg" rows={3} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCorrectionTarget(null)} className="px-3 py-1.5 bg-slate-100 rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold cursor-pointer">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Leave Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4">
          <form onSubmit={handleAssignLeave} className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900">Assign Leave (Pending Warden Approval)</h3>
              <button type="button" onClick={() => setIsLeaveModalOpen(false)} className="text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            {leaveFeedback && <div className="p-2 bg-indigo-50 text-indigo-800 rounded">{leaveFeedback}</div>}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Student (Assigned Hostel Only)</label>
              <select required value={leaveForm.studentId} onChange={(e) => setLeaveForm({ ...leaveForm, studentId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                <option value="">Select student</option>
                {activeResidents.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.enrollmentNo} · Room {s.roomNumber})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                <input type="date" required value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                <input type="date" required value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason</label>
              <textarea required value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" rows={2} />
            </div>
            <p className="text-[11px] text-amber-700">Note: Caretakers cannot approve leaves; this leave will be submitted as Pending for Warden approval.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsLeaveModalOpen(false)} className="px-3 py-1.5 bg-slate-100 rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold cursor-pointer">Assign Leave</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900">Edit Student ({editingStudent.enrollmentNo})</h3>
              <button type="button" onClick={() => setEditingStudent(null)} className="text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            {editFeedback && <div className="p-2 bg-rose-50 text-rose-700 rounded">{editFeedback}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block font-semibold mb-1">Full Name</label><input type="text" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block font-semibold mb-1">Email</label><input type="email" required value={editForm.studentEmail} onChange={(e) => setEditForm({ ...editForm, studentEmail: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block font-semibold mb-1">Enrollment No</label><input type="text" required value={editForm.enrollmentNo} onChange={(e) => setEditForm({ ...editForm, enrollmentNo: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" /></div>
              <div><label className="block font-semibold mb-1">Biometric ID</label><input type="text" required value={editForm.biometricId} onChange={(e) => setEditForm({ ...editForm, biometricId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" /></div>
              <div><label className="block font-semibold mb-1">Course</label><input type="text" required value={editForm.course} onChange={(e) => setEditForm({ ...editForm, course: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block font-semibold mb-1">Room Number</label><input type="text" required value={editForm.roomNumber} onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" /></div>
              <div><label className="block font-semibold mb-1">Bed Number</label><input type="text" required value={editForm.bedNumber} onChange={(e) => setEditForm({ ...editForm, bedNumber: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block font-semibold mb-1">Parent Name</label><input type="text" value={editForm.parentName} onChange={(e) => setEditForm({ ...editForm, parentName: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingStudent(null)} className="px-3 py-1.5 bg-slate-100 rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" disabled={isSavingEdit} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer">{isSavingEdit ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
