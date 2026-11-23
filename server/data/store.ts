import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  User,
  Hostel,
  Room,
  Student,
  AttendanceRecord,
  LeaveRecord,
  LeaveApplication,
  BiometricDevice,
  BiometricPunchLog,
  NotificationLog,
  ScheduledJobLog,
  AuditLog,
  HolidayRecord,
  WarningTicket,
  DisciplinaryCardStatus,
  StudentTokenSummary,
  SemesterSettings,
  TokenHistoryEntry
} from '../types';
import {
  initialUsers,
  initialHostels,
  initialRooms,
  initialStudents,
  initialBiometricDevices,
  initialLeaves,
  initialAttendance,
  initialScheduledJobs,
  initialNotifications,
  initialAuditLogs,
  todayDate
} from './seed';

const clockTimeToSeconds = (time: string): number => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time);
  if (!match) {
    throw new Error(`Invalid clock time "${time}". Expected HH:mm or HH:mm:ss.`);
  }
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
};

const readClockSetting = (name: string, defaultValue: string): string => {
  const value = process.env[name] || defaultValue;
  clockTimeToSeconds(value);
  return value;
};

const addUtcDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const addUtcMonths = (date: string, months: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  const originalDay = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(originalDay, lastDay));
  return value.toISOString().slice(0, 10);
};

const dataDirectory = path.dirname(fileURLToPath(import.meta.url));
const leaveApplicationsFile = path.join(dataDirectory, 'leave-applications.sqlite');
const legacyLeaveApplicationsFile = path.join(dataDirectory, 'leave-applications.json');
const leaveApplicationsDatabase = new DatabaseSync(leaveApplicationsFile);
leaveApplicationsDatabase.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS leave_applications (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    hostel_id TEXT NOT NULL,
    status TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    application_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_leave_applications_student ON leave_applications(student_id, submitted_at);
  CREATE INDEX IF NOT EXISTS idx_leave_applications_hostel ON leave_applications(hostel_id, submitted_at);
`);

const readLeaveApplications = (): LeaveApplication[] => {
  try {
    const stored = leaveApplicationsDatabase.prepare('SELECT application_json FROM leave_applications ORDER BY submitted_at DESC').all() as { application_json: string }[];
    if (stored.length > 0) return stored.map((row) => JSON.parse(row.application_json) as LeaveApplication);
    if (!existsSync(legacyLeaveApplicationsFile)) return [];
    const parsed: unknown = JSON.parse(readFileSync(legacyLeaveApplicationsFile, 'utf8'));
    return Array.isArray(parsed) ? parsed as LeaveApplication[] : [];
  } catch (error) {
    console.error('Unable to load saved leave applications:', error);
    return [];
  }
};

class DataStore {
  users = [...initialUsers];
  hostels = [...initialHostels];
  rooms = [...initialRooms];
  students = [...initialStudents];
  biometricDevices = [...initialBiometricDevices];
  biometricLogs: BiometricPunchLog[] = [];
  leaves = [...initialLeaves];
  leaveApplications: LeaveApplication[] = readLeaveApplications();
  holidays: HolidayRecord[] = [];
  private holidayAttendanceSnapshots = new Map<string, AttendanceRecord>();
  attendance = [...initialAttendance];
  scheduledJobs = [...initialScheduledJobs];
  notifications = [...initialNotifications];
  auditLogs = [...initialAuditLogs];
  warningTickets: WarningTicket[] = [];
  tokenHistory: TokenHistoryEntry[] = [];

  virtualTime: string = '19:15:00';
  virtualDate: string = todayDate;
  cutoffTime: string = readClockSetting('ATTENDANCE_CUTOFF_TIME', '19:00');
  graceEndTime: string = readClockSetting('ATTENDANCE_GRACE_END_TIME', '22:00');
  defaulterFlagTime: string = readClockSetting('DEFAULTER_FLAG_TIME', '22:00');
  semesterStartDate = todayDate;
  semesterEndDate = addUtcDays(addUtcMonths(todayDate, 6), -1);

  sessions = new Map<string, User>();

  constructor() {
    if (clockTimeToSeconds(this.graceEndTime) <= clockTimeToSeconds(this.cutoffTime)) {
      throw new Error('ATTENDANCE_GRACE_END_TIME must be later than ATTENDANCE_CUTOFF_TIME.');
    }
    if (clockTimeToSeconds(this.defaulterFlagTime) !== clockTimeToSeconds(this.graceEndTime)) {
      throw new Error('DEFAULTER_FLAG_TIME must match ATTENDANCE_GRACE_END_TIME.');
    }

    for (const application of this.leaveApplications) {
      const savedLeave = application.approvedLeaveRecord;
      if (savedLeave && !this.leaves.some((leave) => leave.id === savedLeave.id)) {
        this.leaves.unshift(savedLeave);
      }
    }
    if (this.leaveApplications.length > 0) this.persistLeaveApplications();

    for (const u of this.users) {
      this.sessions.set(`token-${u.id}`, {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        phone: u.phone,
        hostelId: u.hostelId,
        blockId: u.blockId,
        studentId: u.studentId
      });
    }
    this.seedTokenHistory();
    this.initWarningTickets();
  }

  persistLeaveApplications() {
    const upsert = leaveApplicationsDatabase.prepare(`
      INSERT INTO leave_applications (id, student_id, hostel_id, status, submitted_at, application_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        student_id = excluded.student_id,
        hostel_id = excluded.hostel_id,
        status = excluded.status,
        submitted_at = excluded.submitted_at,
        application_json = excluded.application_json
    `);
    leaveApplicationsDatabase.exec('BEGIN IMMEDIATE');
    try {
      for (const application of this.leaveApplications) {
        upsert.run(application.id, application.studentId, application.hostelId, application.status, application.submittedAt, JSON.stringify(application));
      }
      leaveApplicationsDatabase.exec('COMMIT');
    } catch (error) {
      leaveApplicationsDatabase.exec('ROLLBACK');
      throw error;
    }
  }

  private getDisciplinaryCardStatus(tokens: number): DisciplinaryCardStatus {
    if (tokens > 10) return 'red_card_blacklist';
    if (tokens >= 6) return 'yellow_card';
    if (tokens >= 1) return 'normal_warning';
    return 'none';
  }

  private seedTokenHistory() {
    const defaulters = this.attendance
      .filter((record) => record.isDefaulter && record.date <= this.virtualDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.studentId.localeCompare(b.studentId));
    const awardedDates = new Set<string>();

    for (const record of defaulters) {
      const eventKey = `${record.studentId}:${record.date}`;
      if (awardedDates.has(eventKey)) continue;
      awardedDates.add(eventKey);

      const semesterTokens = this.tokenHistory
        .filter((entry) => entry.studentId === record.studentId && entry.date >= this.semesterStartDate && entry.date <= this.semesterEndDate)
        .reduce((total, entry) => total + entry.tokensReceived, 0) + (record.date >= this.semesterStartDate && record.date <= this.semesterEndDate ? 1 : 0);
      this.tokenHistory.push({
        id: `token-${record.id}`,
        studentId: record.studentId,
        date: record.date,
        reason: record.remarks || 'Attendance defaulter',
        tokensReceived: 1,
        warningCardStatus: record.date >= this.semesterStartDate && record.date <= this.semesterEndDate
          ? this.getDisciplinaryCardStatus(semesterTokens)
          : 'none'
      });
    }
  }

  recordDefaulter(studentId: string, date: string, reason: string) {
    if (date < this.semesterStartDate || date > this.semesterEndDate) return null;
    if (this.tokenHistory.some((entry) => entry.studentId === studentId && entry.date === date)) {
      return null;
    }

    const semesterTokens = this.tokenHistory
      .filter((entry) => entry.studentId === studentId && entry.date >= this.semesterStartDate && entry.date <= this.semesterEndDate)
      .reduce((total, entry) => total + entry.tokensReceived, 0);
    const entry: TokenHistoryEntry = {
      id: `token-${studentId}-${date}`,
      studentId,
      date,
      reason,
      tokensReceived: 1,
      warningCardStatus: this.getDisciplinaryCardStatus(semesterTokens + 1)
    };
    this.tokenHistory.push(entry);
    return entry;
  }

  getStudentTokenSummary(studentId: string): StudentTokenSummary {
    const defaultersThroughToday = this.attendance
      .filter((record) => record.studentId === studentId && record.isDefaulter && record.date <= this.virtualDate && record.date >= this.semesterStartDate && record.date <= this.semesterEndDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.studentId.localeCompare(b.studentId));
    for (const record of defaultersThroughToday) {
      this.recordDefaulter(record.studentId, record.date, record.remarks || 'Attendance defaulter');
    }

    const history = this.tokenHistory
      .filter((entry) => entry.studentId === studentId && entry.date <= this.virtualDate)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const semesterHistory = history
      .filter((entry) => entry.date >= this.semesterStartDate && entry.date <= this.semesterEndDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let semesterTokens = 0;
    const statusByEntry = new Map<string, DisciplinaryCardStatus>();
    for (const entry of semesterHistory) {
      semesterTokens += entry.tokensReceived;
      statusByEntry.set(entry.id, this.getDisciplinaryCardStatus(semesterTokens));
    }
    const currentHistory = history.map((entry) => ({
      ...entry,
      warningCardStatus: statusByEntry.get(entry.id) || entry.warningCardStatus
    }));
    const lifetimeTokens = history
      .reduce((total, entry) => total + entry.tokensReceived, 0);
    const disciplinaryStatus = this.getDisciplinaryCardStatus(semesterTokens);

    return {
      semesterStartDate: this.semesterStartDate,
      semesterEndDate: this.semesterEndDate,
      semesterTokens,
      lifetimeTokens,
      disciplinaryStatus,
      isBlacklisted: semesterTokens > 10,
      history: currentHistory
    };
  }

  getSemesterSettings(): SemesterSettings {
    const start = new Date(`${this.semesterStartDate}T00:00:00.000Z`).getTime();
    const end = new Date(`${this.semesterEndDate}T00:00:00.000Z`).getTime();
    return { startDate: this.semesterStartDate, endDate: this.semesterEndDate, durationDays: Math.floor((end - start) / 86400000) + 1 };
  }

  setSemesterSettings(startDate: string, endDate: string) {
    this.semesterStartDate = startDate;
    this.semesterEndDate = endDate;
    for (const student of this.students) this.getStudentTokenSummary(student.id);
    this.warningTickets = [];
    this.initWarningTickets();
  }

  initWarningTickets() {
    // Generate initial warning tickets and strike tracking based on historical violations
    const violationsByStudent = new Map<string, { late: number; defaulter: number; latestDate: string }>();

    for (const record of this.attendance) {
      if (record.date >= this.semesterStartDate && record.date <= this.semesterEndDate && (record.status === 'late' || record.status === 'absent' || record.isDefaulter)) {
        const current = violationsByStudent.get(record.studentId) || { late: 0, defaulter: 0, latestDate: record.date };
        if (record.status === 'late') {
          current.late += 1;
        } else {
          current.defaulter += 1;
        }
        if (record.date > current.latestDate) {
          current.latestDate = record.date;
        }
        violationsByStudent.set(record.studentId, current);
      }
    }

    const previousTickets = new Map(this.warningTickets.map((ticket) => [ticket.id, ticket]));
    const tickets: WarningTicket[] = [];
    violationsByStudent.forEach((counts, studentId) => {
      const student = this.students.find((s) => s.id === studentId);
      if (!student) return;

      const hostel = this.hostels.find((h) => h.id === student.hostelId);
      const totalViolations = counts.late + counts.defaulter;
      const previousTicket = previousTickets.get(`ticket-${student.id}`);

      let severity: 'strike_1' | 'strike_2' | 'flagged_for_admin_review' = 'strike_1';
      let status: 'active' | 'under_review' | 'resolved' = 'active';
      let reason = '';

      if (counts.defaulter >= 3 || counts.late >= 4 || totalViolations >= 4) {
        severity = 'flagged_for_admin_review';
        status = 'under_review';
        reason = `Critical Violation: Accumulated ${counts.defaulter} missed check-ins & ${counts.late} late entries. Flagged for Administrative Disciplinary Review by Director & Chief Warden.`;
      } else if (counts.defaulter >= 2 || counts.late >= 2 || totalViolations >= 2) {
        severity = 'strike_2';
        status = 'active';
        reason = `Strike 2 Warning: Second repeated attendance violation (${counts.late} late, ${counts.defaulter} defaulter). Formal hostel warning ticket dispatched.`;
      } else {
        severity = 'strike_1';
        status = 'active';
        reason = `Strike 1 Notice: First attendance violation (${counts.late} late punch or missed 10:00 PM check-in deadline). Notice recorded.`;
      }

      tickets.push({
        id: `ticket-${student.id}`,
        studentId: student.id,
        studentName: student.name,
        enrollmentNo: student.enrollmentNo,
        hostelId: student.hostelId,
        hostelName: hostel ? hostel.name : student.hostelId,
        block: student.block,
        roomNumber: student.roomNumber,
        course: student.course,
        parentName: student.parentName || 'Parent / Guardian',
        parentPhone: student.parentPhone || '',
        parentEmail: student.parentEmail || '',
        latePunchesCount: counts.late,
        missedCheckInsCount: counts.defaulter,
        totalViolations,
        severity,
        status: previousTicket?.status || status,
        issuedAt: `${counts.latestDate} 22:00:00 IST`,
        latestViolationDate: counts.latestDate,
        reason,
        adminNotes: previousTicket?.adminNotes
      });
    });

    // Sort: flagged_for_admin_review first, then strike_2, then strike_1
    const severityWeight = {
      flagged_for_admin_review: 3,
      strike_2: 2,
      strike_1: 1
    };

    tickets.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity] || b.totalViolations - a.totalViolations);
    this.warningTickets = tickets;
  }

  getWarningTickets(hostelId?: string): WarningTicket[] {
    this.initWarningTickets();
    if (!hostelId) return [...this.warningTickets];
    return this.warningTickets.filter((t) => t.hostelId === hostelId);
  }

  updateWarningTicket(id: string, updates: Partial<WarningTicket>): WarningTicket | null {
    const ticket = this.warningTickets.find((t) => t.id === id);
    if (!ticket) return null;
    Object.assign(ticket, updates);
    return ticket;
  }

  getISTTimeString(): string {
    return this.virtualTime;
  }

  setVirtualTime(timeStr: string, dateStr?: string) {
    this.virtualTime = timeStr;
    if (dateStr) this.virtualDate = dateStr;
  }

  isPastCutoff(): boolean {
    return clockTimeToSeconds(this.virtualTime) >= clockTimeToSeconds(this.cutoffTime);
  }

  isWithinGraceWindow(): boolean {
    const seconds = clockTimeToSeconds(this.virtualTime);
    return seconds > clockTimeToSeconds(this.cutoffTime) && seconds <= clockTimeToSeconds(this.graceEndTime);
  }

  isPastDefaulterTime(): boolean {
    return clockTimeToSeconds(this.virtualTime) >= clockTimeToSeconds(this.defaulterFlagTime);
  }

  isHoliday(date: string): boolean {
    return this.holidays.some((holiday) => holiday.startDate <= date && date <= holiday.endDate);
  }

  applyHoliday(startDate: string, endDate: string, reason: string) {
    const holiday: HolidayRecord = {
      id: `holiday-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      startDate,
      endDate,
      reason,
      createdBy: '',
      createdAt: `${this.virtualDate} ${this.virtualTime} IST`
    };
    this.holidays.push(holiday);
    for (let current = startDate; current <= endDate; current = this.addDate(current, 1)) {
      for (const student of this.students.filter((s) => s.verificationStatus === 'verified' && s.checkoutStatus === 'active')) {
        let record = this.attendance.find((a) => a.studentId === student.id && a.date === current);
        if (record) this.holidayAttendanceSnapshots.set(record.id, { ...record });
        else {
          record = {
            id: `att-${student.id}-${current}`, studentId: student.id, enrollmentNo: student.enrollmentNo,
            studentName: student.name, hostelId: student.hostelId, block: student.block,
            roomNumber: student.roomNumber, date: current, status: 'holiday', isDefaulter: false,
            remarks: `${reason} — attendance not required.`
          };
          this.attendance.push(record);
        }
        record.status = 'holiday';
        record.isDefaulter = false;
        record.remarks = `${reason} — attendance not required.`;
      }
    }
    this.tokenHistory = this.tokenHistory.filter((entry) => entry.date < startDate || entry.date > endDate);
    this.initWarningTickets();
    return holiday;
  }

  private addDate(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  removeHoliday(id: string) {
    const holiday = this.holidays.find((item) => item.id === id);
    if (!holiday) return;
    this.holidays = this.holidays.filter((item) => item.id !== id);
    this.attendance = this.attendance.filter((record) => {
      if (record.date < holiday.startDate || record.date > holiday.endDate || record.status !== 'holiday') return true;
      const snapshot = this.holidayAttendanceSnapshots.get(record.id);
      if (snapshot) Object.assign(record, snapshot);
      else return false;
      return true;
    });
    for (const record of this.attendance.filter((a) => a.date >= holiday.startDate && a.date <= holiday.endDate)) this.holidayAttendanceSnapshots.delete(record.id);
    this.initWarningTickets();
  }

  classifyPunch(punchTime: string) {
    const seconds = clockTimeToSeconds(punchTime);
    if (seconds <= clockTimeToSeconds(this.cutoffTime)) {
      return {
        status: 'present' as const,
        isDefaulter: false,
        remarks: `On-time biometric check-in prior to ${this.cutoffTime} IST cut-off.`
      };
    }
    if (seconds <= clockTimeToSeconds(this.graceEndTime)) {
      return {
        status: 'late' as const,
        isDefaulter: false,
        remarks: `Late punch after the ${this.cutoffTime} IST cutoff through ${this.graceEndTime} IST.`
      };
    }
    return {
      status: 'absent' as const,
      isDefaulter: true,
      remarks: `Punch recorded after ${this.defaulterFlagTime} IST. Categorized as Defaulter.`
    };
  }

  logAudit(
    action: string,
    user: { id: string; name: string; role: string },
    targetEntity: string,
    targetId: string,
    details: string
  ) {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: `${this.virtualDate} ${this.virtualTime} IST`,
      action,
      performedByUserId: user.id,
      performedByUserName: user.name,
      performedByUserRole: user.role,
      targetEntity,
      targetId,
      details
    };
    this.auditLogs.unshift(log);
    return log;
  }

  evaluateCutoff(executedBy: { id: string; name: string; role: string } = { id: 'system', name: 'Scheduler Engine', role: 'system' }) {
    if (!this.isPastDefaulterTime()) {
      throw new Error(`Defaulter evaluation is available at ${this.defaulterFlagTime} IST.`);
    }
    const jobStartTime = `${this.virtualDate} ${this.virtualTime} IST`;
    const targetDate = this.virtualDate;

    let presentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;
    let defaultersCount = 0;

    const activeStudents = this.students.filter(
      (s) => s.verificationStatus === 'verified' && s.checkoutStatus === 'active' && !this.isHoliday(targetDate)
    );

    for (const student of activeStudents) {
      let record = this.attendance.find(
        (a) => a.studentId === student.id && a.date === targetDate
      );

      const hasApprovedLeave = this.leaves.some(
        (l) =>
          l.studentId === student.id &&
          targetDate >= l.startDate &&
          targetDate <= l.endDate
      );

      if (hasApprovedLeave) {
        if (!record) {
          record = {
            id: `att-${student.id}-${targetDate}`,
            studentId: student.id,
            enrollmentNo: student.enrollmentNo,
            studentName: student.name,
            hostelId: student.hostelId,
            block: student.block,
            roomNumber: student.roomNumber,
            date: targetDate,
            status: 'approved_leave',
            isDefaulter: false,
            evaluatedAt: `${this.virtualDate} ${this.virtualTime} IST`,
            remarks: 'Approved leave verified by Residential Warden. Absence alerts suppressed.'
          };
          this.attendance.push(record);
        } else {
          record.status = 'approved_leave';
          record.isDefaulter = false;
          record.remarks = 'Approved leave verified by Residential Warden. Absence alerts suppressed.';
        }
        leaveCount++;
        continue;
      }

      if (record && record.punchTime) {
        if (record.status === 'present') presentCount++;
        else if (record.status === 'late') lateCount++;
        else if (record.status === 'absent' && record.isDefaulter) {
          defaultersCount++;
          this.recordDefaulter(student.id, targetDate, record.remarks || 'Attendance defaulter');
          this.triggerSequentialNotifications(student, targetDate);
        }
      } else {
        if (!record) {
          record = {
            id: `att-${student.id}-${targetDate}`,
            studentId: student.id,
            enrollmentNo: student.enrollmentNo,
            studentName: student.name,
            hostelId: student.hostelId,
            block: student.block,
            roomNumber: student.roomNumber,
            date: targetDate,
            status: 'absent',
            isDefaulter: true,
            evaluatedAt: `${this.virtualDate} ${this.virtualTime} IST`,
            remarks: `No biometric punch recorded by ${this.defaulterFlagTime} IST. Categorized as Defaulter.`
          };
          this.attendance.push(record);
        } else {
          record.status = 'absent';
          record.isDefaulter = true;
          record.evaluatedAt = `${this.virtualDate} ${this.virtualTime} IST`;
          record.remarks = `No biometric punch recorded by ${this.defaulterFlagTime} IST. Categorized as Defaulter.`;
        }
        defaultersCount++;
        this.recordDefaulter(student.id, targetDate, record.remarks || 'No biometric punch by the defaulter cutoff');
        this.triggerSequentialNotifications(student, targetDate);
      }
    }

    const jobLog: ScheduledJobLog = {
      id: `job-${Date.now()}`,
      jobName: `Daily ${this.cutoffTime} IST Cutoff & ${this.defaulterFlagTime} Defaulter Evaluation`,
      scheduledTime: `${this.defaulterFlagTime} IST`,
      executedAt: jobStartTime,
      completedAt: `${this.virtualDate} ${this.virtualTime} IST`,
      status: 'completed',
      dateEvaluated: targetDate,
      totalStudents: activeStudents.length,
      presentCount,
      lateCount,
      leaveCount,
      defaultersCount,
      notificationsQueued: defaultersCount * 6
    };

    this.scheduledJobs.unshift(jobLog);
    this.logAudit(
      'CUTOFF_EVALUATED',
      executedBy,
      'AttendanceScheduler',
      jobLog.id,
      `Evaluated ${activeStudents.length} students. Present: ${presentCount}, Late: ${lateCount}, Leave: ${leaveCount}, Defaulters: ${defaultersCount}`
    );

    return jobLog;
  }

  triggerSequentialNotifications(student: Student, date: string) {
    const existing = this.notifications.filter(
      (n) => n.studentId === student.id && n.date === date
    );
    if (existing.length >= 6) return;

    const hostel = this.hostels.find((h) => h.id === student.hostelId);

    const tier1: NotificationLog = {
      id: `notif-${student.id}-t1-${Date.now()}`,
      date,
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 1,
      recipientRole: 'Residential Warden',
      recipientName: hostel ? hostel.residentialWarden : 'Residential Warden',
      recipientEmail: `rw.${hostel ? hostel.code.toLowerCase() : 'hostel'}@university.edu.in`,
      status: 'delivered',
      timestamp: `${this.virtualDate} ${this.virtualTime} IST`,
      retryCount: 0
    };

    const tier2: NotificationLog = {
      id: `notif-${student.id}-t2-${Date.now()}`,
      date,
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 2,
      recipientRole: 'Warden',
      recipientName: `${hostel ? hostel.name : 'Hostel'} Warden`,
      recipientEmail: `warden.${hostel ? hostel.code.toLowerCase() : 'hostel'}@university.edu.in`,
      status: 'delivered',
      timestamp: `${this.virtualDate} ${this.virtualTime} IST`,
      retryCount: 0
    };

    const tier3: NotificationLog = {
      id: `notif-${student.id}-t3-${Date.now()}`,
      date,
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 3,
      recipientRole: 'Chief Warden',
      recipientName: 'Prof. Sameer Varma',
      recipientEmail: 'chiefwarden@university.edu.in',
      status: 'delivered',
      timestamp: `${this.virtualDate} ${this.virtualTime} IST`,
      retryCount: 0
    };

    const tier4: NotificationLog = {
      id: `notif-${student.id}-t4-${Date.now()}`,
      date,
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 4,
      recipientRole: 'Director',
      recipientName: 'Dr. S.K. Pradhan',
      recipientEmail: 'director@university.edu.in',
      status: 'delivered',
      timestamp: `${this.virtualDate} ${this.virtualTime} IST`,
      retryCount: 0
    };

    const parentEmail = student.parentEmail?.trim();
    const tier5: NotificationLog = {
      id: `notif-${student.id}-t5-${Date.now()}`,
      date,
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 5,
      recipientRole: "Student's Parent",
      recipientName: student.parentName || 'Parent / Guardian',
      recipientEmail: parentEmail || '',
      status: parentEmail ? 'delivered' : 'failed',
      failureReason: parentEmail ? undefined : 'Missing parent email address in verified master profile (FR-12 exception)',
      timestamp: `${this.virtualDate} ${this.virtualTime} IST`,
      retryCount: parentEmail ? 0 : 2
    };

    const tier6: NotificationLog = {
      id: `notif-${student.id}-t6-${Date.now()}`,
      date,
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 6,
      recipientRole: 'Student',
      recipientName: student.name,
      recipientEmail: student.studentEmail,
      status: 'delivered',
      timestamp: `${this.virtualDate} ${this.virtualTime} IST`,
      retryCount: 0
    };

    this.notifications.unshift(tier1, tier2, tier3, tier4, tier5, tier6);
  }
}

export const store = new DataStore();
