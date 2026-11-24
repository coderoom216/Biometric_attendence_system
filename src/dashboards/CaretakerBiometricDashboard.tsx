
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
  ShieldCheck
} from 'lucide-react';
import { apiService } from '../services/api';
import { BiometricDevice, Hostel } from '../types';

const DEVICE_SERIAL = 'RSS20241199684';

interface EnrolledUser {
  userId: string;
  deviceSerial: string;
  name: string | null;
  privilege: string | null;
  enabled: boolean | null;
  hasInfo: boolean;
  infoFetchedAt: string | null;
  fingerprintEnrolled: boolean;
  fingerprintCount: number;
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
  const [enrolledUsers, setEnrolledUsers] = useState<EnrolledUser[]>([]);
  const [selectedMachineUserId, setSelectedMachineUserId] = useState('');
  const [studentForm, setStudentForm] = useState<StudentFormData>(
    createInitialForm()
  );

  const [liveData, setLiveData] = useState<any>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [onboardFeedback, setOnboardFeedback] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<
    'device' | 'manual'
  >('device');

  const selectedMachineUser = enrolledUsers.find(
    (user) => user.userId === selectedMachineUserId
  );

  const livePunches = Array.isArray(liveData?.punches)
    ? liveData.punches
    : [];

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
          'Machine enrolled users load nahi ho pa rahe hain.'
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
          'MongoDB se live punches read nahi ho pa rahe hain.'
      );
    }
  };

  const refreshAllData = async () => {
    setIsLoading(true);
    setPageError(null);

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
      loadEnrolledUsers();
      loadLivePunches();
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  const handleMachineUserChange = (userId: string) => {
    setSelectedMachineUserId(userId);
    setOnboardFeedback(null);

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

    setStudentForm((previous) => ({
      ...previous,
      biometricId: machineUser.userId,
      name: machineUser.name || previous.name
    }));
  };

  const handleDeviceRegistration = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setOnboardFeedback(null);

    if (!selectedMachineUser) {
      setOnboardFeedback('Pehle biometric machine ka User ID select karein.');
      return;
    }

    if (!studentForm.hostelId) {
      setOnboardFeedback('Please hostel select karein.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        await apiService.submitDeviceStudentRegistration({
          ...studentForm,
          biometricId: selectedMachineUser.userId,
          deviceSerial: selectedMachineUser.deviceSerial
        });

      if (response.success) {
        setOnboardFeedback(
          'Student registration successfully submit ho gaya. Approval ke baad student verified hoga.'
        );

        setSelectedMachineUserId('');
        setStudentForm(createInitialForm(studentForm.hostelId));

        await loadEnrolledUsers();
      } else {
        setOnboardFeedback(
          response.message || 'Student registration submit nahi hua.'
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

    if (!studentForm.biometricId.trim()) {
      setOnboardFeedback('Manual onboarding ke liye Biometric ID enter karein.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiService.onboardStudent(studentForm);

      if (response.success) {
        setOnboardFeedback(
          `Student ${studentForm.name} successfully registered and verified.`
        );

        setStudentForm(createInitialForm(studentForm.hostelId));
        setSelectedMachineUserId('');
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

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Biometric Terminal & Student Onboarding
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Actual machine users, MongoDB connectivity and student registration
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

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">
                MongoDB Connection
              </p>
              <p className={`text-lg font-bold mt-2 ${
                mongoConnected ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {mongoConnected ? 'Connected' : 'Not Connected'}
              </p>
            </div>
            <Database className={`w-8 h-8 ${
              mongoConnected ? 'text-emerald-500' : 'text-rose-500'
            }`} />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Database: {liveData?.mongo?.database || 'biometric_db'}
          </p>
        </div>

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

      {/* Device Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Cpu className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-sm text-slate-800">
            Biometric Device Information
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Device Serial Number</p>
            <p className="font-mono font-bold text-sm text-slate-800 mt-1">
              {DEVICE_SERIAL}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">MongoDB Collection</p>
            <p className="font-mono font-bold text-sm text-slate-800 mt-1">
              {liveData?.mongo?.collection || 'glog_data'}
            </p>
          </div>
        </div>

        {devices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">
              Registered Devices
            </p>

            {devices.map((device) => (
              <div
                key={device.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-slate-100 rounded-lg"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {device.name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {device.deviceId}
                  </p>
                </div>

                <span className={`text-xs font-bold ${
                  device.status === 'online_synced'
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}>
                  {device.status === 'online_synced'
                    ? 'Online Synced'
                    : 'Pending / Stale'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enrolled Machine Users */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Actual Machine Enrolled Users
            </h2>
          </div>

          <span className="text-xs text-slate-500">
            Auto refresh: 10 seconds
          </span>
        </div>

        {enrolledUsers.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Abhi API se koi enrolled user record nahi mila.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Machine User ID</th>
                  <th className="p-3">Machine Name</th>
                  <th className="p-3">Privilege</th>
                  <th className="p-3">Fingerprint</th>
                  <th className="p-3">Info Status</th>
                </tr>
              </thead>

              <tbody>
                {enrolledUsers.map((user) => (
                  <tr
                    key={`${user.deviceSerial}-${user.userId}`}
                    className="border-t border-slate-100"
                  >
                    <td className="p-3 font-mono font-bold">
                      {user.userId}
                    </td>
                    <td className="p-3">
                      {user.name || 'Name not fetched'}
                    </td>
                    <td className="p-3">
                      {user.privilege || 'Not available'}
                    </td>
                    <td className="p-3">
                      {user.fingerprintEnrolled
                        ? `Yes (${user.fingerprintCount})`
                        : 'Not confirmed'}
                    </td>
                    <td className="p-3">
                      {user.hasInfo ? (
                        <span className="text-emerald-600 font-semibold">
                          Fetched
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold">
                          Pending fetch
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Note: Fingerprint status machine ke enrollment metadata par based hai.
          Actual fingerprint template is screen par transfer ya display nahi
          kiya ja raha.
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
              Machine se enrolled User ID select karein. Student details
              bharne ke baad registration pending verification mein jayega.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-900">
              Manual onboarding
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Existing manual onboarding process available hai. Is process
              mein existing backend ke mutabik student verified create hota hai.
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
                .filter((user) => user.deviceSerial === DEVICE_SERIAL)
                .map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.userId} - {user.name || 'Name not fetched'}
                  </option>
                ))}
            </select>

            {selectedMachineUser && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p>
                  <strong>Machine User ID:</strong>{' '}
                  {selectedMachineUser.userId}
                </p>
                <p>
                  <strong>Machine Name:</strong>{' '}
                  {selectedMachineUser.name || 'Not available'}
                </p>
                <p>
                  <strong>Fingerprint Enrolled:</strong>{' '}
                  {selectedMachineUser.fingerprintEnrolled ? 'Yes' : 'Not confirmed'}
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
                Hostel
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
                {hostels.map((hostel) => (
                  <option key={hostel.id} value={hostel.id}>
                    {hostel.name}
                  </option>
                ))}
              </select>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Number
              </label>
              <input
                type="text"
                required
                value={studentForm.roomNumber}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    roomNumber: event.target.value
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bed Number
              </label>
              <input
                type="text"
                value={studentForm.bedNumber}
                onChange={(event) =>
                  setStudentForm({
                    ...studentForm,
                    bedNumber: event.target.value
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
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
              onboardFeedback.toLowerCase().includes('submit ho gaya')
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {onboardFeedback}
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
                ? 'Submit for Warden Verification'
                : 'Onboard & Verify Student'}
          </button>

        </form>
      </div>

      {/* Live Punches */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">

        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Clock className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-sm text-slate-800">
            Live Biometric Punch Records
          </h2>
        </div>

        {liveError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {liveError}
          </div>
        )}

        {!liveError && livePunches.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">
            MongoDB se abhi koi punch record return nahi hua.
          </div>
        )}

        {livePunches.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Biometric ID</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Enrollment No</th>
                  <th className="p-3">Punch Time</th>
                  <th className="p-3">Direction</th>
                  <th className="p-3">Recognition</th>
                </tr>
              </thead>

              <tbody>
                {livePunches.map((punch: any, index: number) => (
                  <tr
                    key={punch.id || index}
                    className="border-t border-slate-100"
                  >
                    <td className="p-3 font-mono">
                      {punch.biometricId || '-'}
                    </td>
                    <td className="p-3">
                      {punch.studentName || 'Unrecognized'}
                    </td>
                    <td className="p-3">
                      {punch.enrollmentNo || '-'}
                    </td>
                    <td className="p-3">
                      {punch.punchTime || '-'}
                    </td>
                    <td className="p-3">
                      {punch.direction || '-'}
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
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {pageError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {pageError}
        </div>
      )}

    </div>
  );
};
