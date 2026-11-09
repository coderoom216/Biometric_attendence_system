import axios from 'axios';
import {
  User,
  Hostel,
  Room,
  Student,
  AttendanceRecord,
  LeaveRecord,
  NotificationLog,
  ScheduledJobLog,
  BiometricDevice,
  AuditLog,
  SecurityTestCaseResult
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach Bearer session token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hostel_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token expiration / unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired or invalid
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('hostel_auth_token');
      }
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Auth
  async login(email: string, password: string) {
    const res = await api.post<{ success: boolean; token: string; user: User }>('/auth/login', { email, password });
    return res.data;
  },
  async getMe() {
    const res = await api.get<{ success: boolean; user: User }>('/auth/me');
    return res.data;
  },
  async logout() {
    const res = await api.post<{ success: boolean; message: string }>('/auth/logout');
    return res.data;
  },
  async forgotPassword(email: string) {
    const res = await api.post<{ success: boolean; message: string }>('/auth/forgot-password', { email });
    return res.data;
  },
  async resetPassword(email: string, newPassword: string) {
    const res = await api.post<{ success: boolean; message: string }>('/auth/reset-password', { email, newPassword });
    return res.data;
  },

  // Attendance
  async getTodayAttendance() {
    const res = await api.get<{
      success: boolean;
      date: string;
      virtualTime: string;
      isPastCutoff: boolean;
      isPastDefaulterTime: boolean;
      stats: {
        total: number;
        present: number;
        late: number;
        approvedLeave: number;
        absent: number;
        defaulters: number;
      };
      records: AttendanceRecord[];
    }>('/attendance/today');
    return res.data;
  },
  async getDefaulters(date?: string, hostelId?: string) {
    const res = await api.get<{
      success: boolean;
      targetDate: string;
      virtualTime: string;
      isDefaulterListVisible: boolean;
      count: number;
      defaulters: AttendanceRecord[];
    }>('/attendance/defaulters', { params: { date, hostelId } });
    return res.data;
  },
  async getLatePunches(date?: string, hostelId?: string) {
    const res = await api.get<{
      success: boolean;
      targetDate: string;
      virtualTime: string;
      count: number;
      latePunches: AttendanceRecord[];
    }>('/attendance/late-punches', { params: { date, hostelId } });
    return res.data;
  },
  async getAttendanceHistory(filters?: {
    startDate?: string;
    endDate?: string;
    hostelId?: string;
    block?: string;
    status?: string;
    search?: string;
  }) {
    const res = await api.get<{
      success: boolean;
      totalRecords: number;
      records: AttendanceRecord[];
    }>('/attendance/history', { params: filters });
    return res.data;
  },
  async correctAttendance(recordId: string, newStatus: string, reason: string) {
    const res = await api.post<{
      success: boolean;
      message: string;
      record: AttendanceRecord;
    }>('/attendance/correct', { recordId, newStatus, reason });
    return res.data;
  },
  async recordPunch(studentId: string, punchTime?: string) {
    const res = await api.post<{ success: boolean; message: string; record: AttendanceRecord }>('/attendance/record-punch', {
      studentId,
      punchTime
    });
    return res.data;
  },

  // Leaves
  async getLeaves() {
    const res = await api.get<{ success: boolean; total: number; leaves: LeaveRecord[] }>('/leaves');
    return res.data;
  },
  async enterLeave(payload: {
    studentId: string;
    startDate: string;
    endDate: string;
    reason: string;
    gatePassNo: string;
    parentConsentVerified: boolean;
    notes?: string;
  }) {
    const res = await api.post<{ success: boolean; message: string; leave: LeaveRecord }>('/leaves/enter', payload);
    return res.data;
  },

  // Students
  async getStudents() {
    const res = await api.get<{ success: boolean; total: number; students: Student[] }>('/students');
    return res.data;
  },
  async getStudentById(id: string) {
    const res = await api.get<{ success: boolean; student: Student }>(`/students/${id}`);
    return res.data;
  },
  async onboardStudent(data: Partial<Student>) {
    const res = await api.post<{ success: boolean; message: string; student: Student }>('/students/onboard', data);
    return res.data;
  },
  async verifyStudentRegistration(studentId: string, action: 'approve' | 'reject', rejectionReason?: string) {
    const res = await api.post<{ success: boolean; message: string; student: Student }>('/students/verify', {
      studentId,
      action,
      rejectionReason
    });
    return res.data;
  },
  async submitRegistration(data: Partial<Student>) {
    const res = await api.post<{ success: boolean; message: string; student: Student }>('/students/submit-registration', data);
    return res.data;
  },

  // Hostels & Rooms
  async getHostels() {
    const res = await api.get<{ success: boolean; hostels: Hostel[] }>('/hostels');
    return res.data;
  },
  async getHostelRooms(hostelId: string) {
    const res = await api.get<{ success: boolean; hostelId: string; totalRooms: number; rooms: Room[] }>(`/hostels/${hostelId}/rooms`);
    return res.data;
  },
  async allocateRoom(payload: { studentId: string; hostelId: string; block: string; roomNumber: string; bedNumber?: string }) {
    const res = await api.post<{ success: boolean; message: string; student: Student }>('/hostels/allocate-room', payload);
    return res.data;
  },
  async checkoutHostel(payload: { studentId: string; clearanceNotes?: string }) {
    const res = await api.post<{ success: boolean; message: string; student: Student }>('/hostels/checkout', payload);
    return res.data;
  },

  // Biometrics
  async getBiometricDevices() {
    const res = await api.get<{ success: boolean; authorizedAdministrator: string; devices: BiometricDevice[] }>('/biometric/devices');
    return res.data;
  },
  async syncBiometricLogs(deviceId: string, punches: { biometricId: string; punchTime?: string; punchTimestamp?: string }[]) {
    const res = await api.post<{
      success: boolean;
      message: string;
      deviceId: string;
      processedCount: number;
      duplicateCount: number;
      unrecognizedCount: number;
      lastSyncAt: string;
    }>('/biometric/sync', { deviceId, punches });
    return res.data;
  },
  async getBiometricHealth() {
    const res = await api.get<{
      success: boolean;
      systemHealth: string;
      totalDevices: number;
      syncedDevices: number;
      staleDevicesCount: number;
      staleDevices: any[];
      missingParentEmailsCount: number;
      missingParentEmails: any[];
      notificationFailuresCount: number;
      notificationFailures: NotificationLog[];
    }>('/biometric/health');
    return res.data;
  },

  // Notifications
  async getNotificationLogs(filters?: { studentId?: string; tier?: number; status?: string; date?: string }) {
    const res = await api.get<{
      success: boolean;
      stats: { total: number; delivered: number; queued: number; failed: number };
      hierarchy: string[];
      logs: NotificationLog[];
    }>('/notifications/logs', { params: filters });
    return res.data;
  },
  async retryNotification(notificationId: string, overrideEmail?: string) {
    const res = await api.post<{ success: boolean; message: string; notification: NotificationLog }>('/notifications/retry', {
      notificationId,
      overrideEmail
    });
    return res.data;
  },

  // Scheduler & Clock
  async getSchedulerStatus() {
    const res = await api.get<{
      success: boolean;
      virtualDate: string;
      virtualTime: string;
      cutoffTime: string;
      graceEndTime: string;
      defaulterFlagTime: string;
      isPastCutoff: boolean;
      isWithinGraceWindow: boolean;
      isPastDefaulterTime: boolean;
      scheduledJobs: ScheduledJobLog[];
    }>('/scheduler/status');
    return res.data;
  },
  async triggerCutoffEvaluation() {
    const res = await api.post<{ success: boolean; message: string; jobLog: ScheduledJobLog }>('/scheduler/evaluate-cutoff');
    return res.data;
  },
  async setVirtualClock(time: string, date?: string) {
    const res = await api.post<{
      success: boolean;
      message: string;
      virtualDate: string;
      virtualTime: string;
      isPastCutoff: boolean;
      isPastDefaulterTime: boolean;
    }>('/scheduler/set-clock', { time, date });
    return res.data;
  },

  // Reports
  async getReportSummary(date?: string) {
    const res = await api.get<{
      success: boolean;
      date: string;
      consolidated: any;
      hostelReports: any[];
      dateWiseTrends?: any[];
    }>('/reports/summary', { params: { date } });
    return res.data;
  },
  async getReportTrends() {
    const res = await api.get<{
      success: boolean;
      trends: any[];
    }>('/reports/trends');
    return res.data;
  },

  // Security Tests (10 Mandatory Test Cases)
  async runSecurityTests() {
    const res = await api.get<{
      success: boolean;
      totalTests: number;
      passedCount: number;
      failedCount: number;
      allPassed: boolean;
      executedAt: string;
      results: SecurityTestCaseResult[];
    }>('/security-test/run');
    return res.data;
  },

  // System
  async getAuditLogs() {
    const res = await api.get<{ success: boolean; total: number; logs: AuditLog[] }>('/system/audit-logs');
    return res.data;
  },
  async getSystemOverview() {
    const res = await api.get<{
      success: boolean;
      virtualDate: string;
      virtualTime: string;
      isPastCutoff: boolean;
      isPastDefaulterTime: boolean;
      stats: any;
    }>('/system/overview');
    return res.data;
  }
};
