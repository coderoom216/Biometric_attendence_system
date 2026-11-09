import {
  User,
  Hostel,
  Room,
  Student,
  AttendanceRecord,
  LeaveRecord,
  BiometricDevice,
  BiometricPunchLog,
  NotificationLog,
  ScheduledJobLog,
  AuditLog,
  WarningTicket
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

class DataStore {
  users = [...initialUsers];
  hostels = [...initialHostels];
  rooms = [...initialRooms];
  students = [...initialStudents];
  biometricDevices = [...initialBiometricDevices];
  biometricLogs: BiometricPunchLog[] = [];
  leaves = [...initialLeaves];
  attendance = [...initialAttendance];
  scheduledJobs = [...initialScheduledJobs];
  notifications = [...initialNotifications];
  auditLogs = [...initialAuditLogs];
  warningTickets: WarningTicket[] = [];

  virtualTime: string = '19:15:00';
  virtualDate: string = todayDate;
  cutoffTime: string = readClockSetting('ATTENDANCE_CUTOFF_TIME', '19:00');
  graceEndTime: string = readClockSetting('ATTENDANCE_GRACE_END_TIME', '22:00');
  defaulterFlagTime: string = readClockSetting('DEFAULTER_FLAG_TIME', '22:00');

  sessions = new Map<string, User>();

  constructor() {
    if (clockTimeToSeconds(this.graceEndTime) <= clockTimeToSeconds(this.cutoffTime)) {
      throw new Error('ATTENDANCE_GRACE_END_TIME must be later than ATTENDANCE_CUTOFF_TIME.');
    }
    if (clockTimeToSeconds(this.defaulterFlagTime) !== clockTimeToSeconds(this.graceEndTime)) {
      throw new Error('DEFAULTER_FLAG_TIME must match ATTENDANCE_GRACE_END_TIME.');
    }

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
    this.initWarningTickets();
  }

  initWarningTickets() {
    // Generate initial warning tickets and strike tracking based on historical violations
    const violationsByStudent = new Map<string, { late: number; defaulter: number; latestDate: string }>();

    for (const record of this.attendance) {
      if (record.status === 'late' || record.status === 'absent' || record.isDefaulter) {
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

    const tickets: WarningTicket[] = [];
    violationsByStudent.forEach((counts, studentId) => {
      const student = this.students.find((s) => s.id === studentId);
      if (!student) return;

      const hostel = this.hostels.find((h) => h.id === student.hostelId);
      const totalViolations = counts.late + counts.defaulter;

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
        status,
        issuedAt: `${counts.latestDate} 22:00:00 IST`,
        latestViolationDate: counts.latestDate,
        reason
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
      (s) => s.verificationStatus === 'verified' && s.checkoutStatus === 'active'
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
