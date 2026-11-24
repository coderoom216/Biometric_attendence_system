import {
  User,
  Hostel,
  Room,
  Student,
  AttendanceRecord,
  LeaveRecord,
  BiometricDevice,
  NotificationLog,
  ScheduledJobLog,
  AuditLog
} from '../types';

export const initialUsers: (User & { passwordHash: string })[] = [
  // Director Sir
  {
    id: 'usr-director',
    name: 'Dr. S.K.Pradhan',
    email: 'director@university.edu.in',
    role: 'director',
    phone: '+91 98765 00001',
    passwordHash: 'director123'
  },
  // Chief Warden (All Hostels) - Prof. Sameer Varma
  {
    id: 'usr-chief-warden',
    name: 'Prof. Sameer Varma',
    email: 'chiefwarden@university.edu.in',
    role: 'chief_warden',
    phone: '+91 98765 00002',
    passwordHash: 'chief123'
  },
  // Warden - Boys Hostel 1: Dr. Sati Sir
  {
    id: 'usr-rw-shivalik',
    name: 'Mr.Sachin Sir',
    email: 'rw.shivalik@university.edu.in',
    role: 'residential_warden',
    phone: '+91 98765 00011',
    hostelId: 'h-shivalik',
    blockId: 'Block A',
    passwordHash: 'rw123'
  },
  // Warden - Girls Hostel: Dr. Kavita Tariyal
  {
    id: 'usr-w-mandakini',
    name: 'Dr. Kavita Tariyal',
    email: 'warden.mandakini@university.edu.in',
    role: 'warden',
    phone: '+91 98765 00022',
    hostelId: 'h-mandakini',
    passwordHash: 'warden123'
  },
  // Warden - Boys Hostel 2: Dr. Pathak Sir
  {
    id: 'usr-rw-nilgiri',
    name: 'Dr. Pathak Sir',
    email: 'rw.nilgiri@university.edu.in',
    role: 'warden',
    phone: '+91 98765 00044',
    hostelId: 'h-nilgiri',
    passwordHash: 'pathak123'
  },
  // Caretaker / Biometric Operator - Mr. Vivek Mehra (Computer Science Dept)
  {
    id: 'usr-mr-mehra',
    name: 'Mr. Vivek Mehra (CSE Dept)',
    email: 'vmehra@university.edu.in',
    role: 'caretaker_operator',
    phone: '+91 98765 00033',
    passwordHash: 'mehra123'
  },
  // Student: Rahul Sharma (Boys Hostel 1)
  {
    id: 'usr-stu-101',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@student.edu.in',
    role: 'student',
    studentId: 'stu-bh1-1',
    phone: '+91 91234 56789',
    hostelId: 'h-shivalik',
    passwordHash: 'student123'
  }
];

export const initialHostels: Hostel[] = [
  {
    id: 'h-shivalik',
    name: 'Boys Hostel 1',
    code: 'BH1',
    type: 'boys',
    blocks: ['Block A', 'Block B'],
    totalFloors: 3,
    totalRooms: 60,
    capacity: 180,
    chiefWarden: 'Prof. Sameer Varma',
    residentialWarden: 'Dr. Sati Sir'
  },
  {
    id: 'h-mandakini',
    name: 'Girls Hostel',
    code: 'GH',
    type: 'girls',
    blocks: ['Block A', 'Block B'],
    totalFloors: 3,
    totalRooms: 55,
    capacity: 165,
    chiefWarden: 'Prof. Sameer Varma',
    residentialWarden: 'Dr. Kavita Tariyal'
  },
  {
    id: 'h-nilgiri',
    name: 'Boys Hostel 2',
    code: 'BH2',
    type: 'boys',
    blocks: ['Block A', 'Block B'],
    totalFloors: 3,
    totalRooms: 60,
    capacity: 180,
    chiefWarden: 'Prof. Sameer Varma',
    residentialWarden: 'Dr. Pathak Sir'
  }
];

// Generate 60 rooms for BH1, 55 for GH, 60 for BH2 (all available initially)
export const initialRooms: Room[] = [];
[
  { hostelId: 'h-shivalik', totalRooms: 60 },
  { hostelId: 'h-mandakini', totalRooms: 55 },
  { hostelId: 'h-nilgiri', totalRooms: 60 }
].forEach(({ hostelId, totalRooms }) => {
  for (let r = 1; r <= totalRooms; r++) {
    const block = r <= 25 ? 'Block A' : 'Block B';
    const floor = Math.ceil(r / 20);
    const roomOnFloor = ((r - 1) % 20) + 1;
    const roomNumber = `${floor}${String(roomOnFloor).padStart(2, '0')}`;
    initialRooms.push({
      id: `room-${hostelId}-${r}`,
      hostelId,
      block,
      floor,
      roomNumber,
      capacity: 3,
      currentOccupancy: 0,
      status: 'available'
    });
  }
});

// All students are populated exclusively from physical biometric enrollments & registrations
export const initialStudents: Student[] = [];

export const initialBiometricDevices: BiometricDevice[] = [
  {
    id: 'bdev-shiv-01',
    deviceId: 'RSS20241199684',
    name: 'Boys Hostel 1 Biometric Device (S362)',
    hostelId: 'h-shivalik',
    location: 'Ground Floor Main Entrance',
    totalLogsStoredLocally: 0,
    lastSyncAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    status: 'online_synced',
    authorizedTechnician: 'Mr. Vivek Mehra (CSE Dept)'
  },
  {
    id: 'bdev-mand-01',
    deviceId: 'ESSL-X990-GH',
    name: 'Girls Hostel Security Gate',
    hostelId: 'h-mandakini',
    location: 'Main Security Checkpoint',
    totalLogsStoredLocally: 0,
    lastSyncAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    status: 'online_synced',
    authorizedTechnician: 'Mr. Vivek Mehra (CSE Dept)'
  },
  {
    id: 'bdev-nilg-01',
    deviceId: 'ESSL-K30-BH2',
    name: 'Boys Hostel 2 Biometric Terminal',
    hostelId: 'h-nilgiri',
    location: 'Hostel Reception Turnstile',
    totalLogsStoredLocally: 0,
    lastSyncAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    status: 'online_synced',
    authorizedTechnician: 'Mr. Vivek Mehra (CSE Dept)'
  }
];

export const initialLeaves: LeaveRecord[] = [];

export const todayDate = new Date().toISOString().split('T')[0];

export const initialAttendance: AttendanceRecord[] = [];

export const initialNotifications: NotificationLog[] = [];

export const initialAuditLogs: AuditLog[] = [];

export const initialScheduledJobs: ScheduledJobLog[] = [];

