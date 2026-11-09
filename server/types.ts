export type UserRole = 
  | 'student' 
  | 'residential_warden' 
  | 'warden' 
  | 'chief_warden' 
  | 'director' 
  | 'caretaker_operator';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  hostelId?: string; // For Residential Warden & Warden
  blockId?: string;
  studentId?: string; // For Student role linked to student profile
  avatarUrl?: string;
}

export interface Hostel {
  id: string;
  name: string;
  code: string;
  type: 'boys' | 'girls';
  blocks: string[];
  totalFloors: number;
  totalRooms: number;
  capacity: number;
  chiefWarden: string;
  residentialWarden: string;
}

export interface Room {
  id: string;
  hostelId: string;
  block: string;
  floor: number;
  roomNumber: string;
  capacity: number;
  currentOccupancy: number;
  status: 'available' | 'full' | 'maintenance';
}

export interface Student {
  id: string;
  enrollmentNo: string;
  name: string;
  course: string;
  semester: number;
  gender: 'male' | 'female' | 'other';
  hostelId: string;
  block: string;
  roomNumber: string;
  bedNumber?: string;
  biometricId: string;
  studentEmail: string;
  studentPhone: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  verificationStatus: 'verified' | 'pending_verification' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  allotmentDate: string;
  checkoutDate?: string;
  checkoutStatus: 'active' | 'vacated';
}

export type AttendanceStatus = 'present' | 'late' | 'approved_leave' | 'absent';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  enrollmentNo: string;
  studentName: string;
  hostelId: string;
  block: string;
  roomNumber: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  punchTime?: string; // HH:mm:ss IST
  biometricDeviceId?: string;
  isDefaulter: boolean;
  evaluatedAt?: string;
  correctedBy?: string;
  correctedAt?: string;
  correctionReason?: string;
  remarks?: string;
}

export interface LeaveRecord {
  id: string;
  studentId: string;
  enrollmentNo: string;
  studentName: string;
  hostelId: string;
  block: string;
  roomNumber: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  gatePassNo: string;
  parentConsentVerified: boolean;
  enteredByResidentialWardenId: string;
  residentialWardenName: string;
  createdAt: string;
  notes?: string;
}

export type NotificationTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface NotificationLog {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  hostelId: string;
  tier: NotificationTier;
  recipientRole: string;
  recipientName: string;
  recipientEmail: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  failureReason?: string;
  timestamp: string;
  retryCount: number;
}

export interface ScheduledJobLog {
  id: string;
  jobName: string;
  scheduledTime: string; // e.g. "19:00 IST"
  executedAt: string;
  completedAt: string;
  status: 'completed' | 'failed' | 'in_progress';
  dateEvaluated: string;
  totalStudents: number;
  presentCount: number;
  lateCount: number;
  leaveCount: number;
  defaultersCount: number;
  notificationsQueued: number;
  errorMessage?: string;
}

export interface BiometricDevice {
  id: string;
  deviceId: string;
  name: string;
  hostelId: string;
  location: string;
  totalLogsStoredLocally: number;
  lastSyncAt: string;
  status: 'online_synced' | 'stale_pending_import' | 'error';
  authorizedTechnician: string; // e.g. "Mr. Mehra (Computer Science Dept)"
}

export interface BiometricPunchLog {
  id: string;
  biometricId: string;
  deviceId: string;
  punchTimestamp: string;
  importedAt: string;
  importedBy: string;
  status: 'processed' | 'duplicate_ignored' | 'unrecognized_id';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  performedByUserId: string;
  performedByUserName: string;
  performedByUserRole: string;
  targetEntity: string;
  targetId: string;
  details: string;
  ipAddress?: string;
}

export interface WarningTicket {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  hostelId: string;
  hostelName: string;
  block: string;
  roomNumber: string;
  course: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  latePunchesCount: number;
  missedCheckInsCount: number;
  totalViolations: number;
  severity: 'strike_1' | 'strike_2' | 'flagged_for_admin_review';
  status: 'active' | 'under_review' | 'resolved';
  issuedAt: string;
  latestViolationDate: string;
  reason: string;
  adminNotes?: string;
}
