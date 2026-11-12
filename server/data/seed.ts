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

// Generate 60 rooms for BH1, 55 for GH, 60 for BH2
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
    const isOccupied = r <= 50; // First 50 rooms occupied with 3 students = 150 residents
    initialRooms.push({
      id: `room-${hostelId}-${r}`,
      hostelId,
      block,
      floor,
      roomNumber,
      capacity: 3,
      currentOccupancy: isOccupied ? 3 : 0,
      status: isOccupied ? 'full' : 'available'
    });
  }
});

// Deterministic Generation of 150 students per hostel = 450 active verified students
const firstNamesBoys = ['Rahul', 'Aman', 'Rohan', 'Vikram', 'Aditya', 'Harsh', 'Siddharth', 'Varun', 'Naveen', 'Kunal', 'Dev', 'Manish', 'Alok', 'Yash', 'Saurabh', 'Gaurav', 'Deepak', 'Rohit', 'Ayush', 'Kartik'];
const firstNamesGirls = ['Priya', 'Sneha', 'Ananya', 'Pooja', 'Neha', 'Rhea', 'Kavita', 'Tanvi', 'Ishita', 'Divya', 'Shreya', 'Simran', 'Megha', 'Sakshi', 'Bhavna', 'Kritika', 'Swati', 'Aditi', 'Nisha', 'Aastha'];
const lastNames = ['Sharma', 'Verma', 'Deshmukh', 'Patel', 'Kulkarni', 'Rathore', 'Gupta', 'Singh', 'Dubey', 'Mehta', 'Chopra', 'Mishra', 'Joshi', 'Bhatia', 'Yadav', 'Rawat', 'Pandey', 'Saxena', 'Iyer', 'Menon'];
const courses = ['B.Tech (CSE)', 'B.Tech (IT)', 'B.Tech (ECE)', 'B.Tech (EE)', 'B.Tech (ME)', 'MCA', 'M.Tech (AI)'];

export const initialStudents: Student[] = [];

const hostelConfigs = [
  { id: 'h-shivalik', name: 'Boys Hostel 1', code: 'BH1', gender: 'male' as const, warden: 'Dr. Sati Sir' },
  { id: 'h-mandakini', name: 'Girls Hostel', code: 'GH', gender: 'female' as const, warden: 'Dr. Kavita Tariyal' },
  { id: 'h-nilgiri', name: 'Boys Hostel 2', code: 'BH2', gender: 'male' as const, warden: 'Dr. Pathak Sir' }
];

hostelConfigs.forEach((hConfig) => {
  for (let i = 1; i <= 150; i++) {
    const isBlockA = i <= 75;
    const block = isBlockA ? 'Block A' : 'Block B';
    const roomIndex = isBlockA ? Math.ceil(i / 3) : Math.ceil((i - 75) / 3) + 25;
    const floor = Math.ceil(roomIndex / 20);
    const roomOnFloor = ((roomIndex - 1) % 20) + 1;
    const roomNumber = `${floor}${String(roomOnFloor).padStart(2, '0')}`;
    const bedNumber = ['A', 'B', 'C'][(i - 1) % 3];
    const fNames = hConfig.gender === 'male' ? firstNamesBoys : firstNamesGirls;
    const fName = fNames[(i - 1) % fNames.length];
    const lName = lastNames[(i + 3) % lastNames.length];
    const studentName = i === 1 && hConfig.id === 'h-shivalik' ? 'Rahul Sharma' :
                        i === 1 && hConfig.id === 'h-mandakini' ? 'Priya Patel' :
                        i === 1 && hConfig.id === 'h-nilgiri' ? 'Vikram Rathore' :
                        `${fName} ${lName}`;
    const enrollmentNo = `23${hConfig.code}${String(100 + i).slice(-3)}`;
    const studentEmail = `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@student.edu.in`;
    const parentEmail = `parent.${fName.toLowerCase()}${i}@example.com`;

    initialStudents.push({
      id: `stu-${hConfig.code.toLowerCase()}-${i}`,
      enrollmentNo,
      name: studentName,
      course: courses[(i - 1) % courses.length],
      semester: ((i % 8) || 8),
      gender: hConfig.gender,
      hostelId: hConfig.id,
      block,
      roomNumber,
      bedNumber,
      biometricId: `BIO-${hConfig.code}-${String(100 + i).slice(-3)}`,
      studentEmail,
      studentPhone: `+91 98${String(10000000 + i * 37).slice(-8)}`,
      parentName: `Mr. ${lName}`,
      parentEmail,
      parentPhone: `+91 97${String(20000000 + i * 43).slice(-8)}`,
      verificationStatus: 'verified',
      verifiedBy: `${hConfig.warden} (Warden)`,
      verifiedAt: '2026-08-01 10:00 IST',
      allotmentDate: '2026-08-01',
      checkoutStatus: 'active'
    });
  }
});

export const initialBiometricDevices: BiometricDevice[] = [
  {
    id: 'bdev-shiv-01',
    deviceId: 'ESSL-K30-BH1',
    name: 'Boys Hostel 1 Main Turnstile Gate',
    hostelId: 'h-shivalik',
    location: 'Ground Floor Main Entrance',
    totalLogsStoredLocally: 450,
    lastSyncAt: '2026-10-27 18:45:00 IST',
    status: 'online_synced',
    authorizedTechnician: 'Mr. Vivek Mehra (CSE Dept)'
  },
  {
    id: 'bdev-mand-01',
    deviceId: 'ESSL-X990-GH',
    name: 'Girls Hostel Security Gate',
    hostelId: 'h-mandakini',
    location: 'Main Security Checkpoint',
    totalLogsStoredLocally: 420,
    lastSyncAt: '2026-10-27 18:50:00 IST',
    status: 'online_synced',
    authorizedTechnician: 'Mr. Vivek Mehra (CSE Dept)'
  },
  {
    id: 'bdev-nilg-01',
    deviceId: 'ESSL-K30-BH2',
    name: 'Boys Hostel 2 Biometric Terminal',
    hostelId: 'h-nilgiri',
    location: 'Hostel Reception Turnstile',
    totalLogsStoredLocally: 410,
    lastSyncAt: '2026-10-27 18:35:00 IST',
    status: 'online_synced',
    authorizedTechnician: 'Mr. Vivek Mehra (CSE Dept)'
  }
];

// Exactly 5 approved leaves per hostel = 15 total leaves
export const initialLeaves: LeaveRecord[] = [];
hostelConfigs.forEach((hConfig) => {
  // Students at index 91 to 95 are on approved leave
  for (let l = 1; l <= 5; l++) {
    const studentIndex = 90 + l;
    const student = initialStudents.find((s) => s.id === `stu-${hConfig.code.toLowerCase()}-${studentIndex}`);
    if (student) {
      initialLeaves.push({
        id: `leave-${hConfig.code.toLowerCase()}-${l}`,
        studentId: student.id,
        enrollmentNo: student.enrollmentNo,
        studentName: student.name,
        hostelId: student.hostelId,
        block: student.block,
        roomNumber: student.roomNumber,
        startDate: '2026-10-25',
        endDate: '2026-10-29',
        reason: l === 1 ? 'Family emergency and medical consult (letter verified)' :
                l === 2 ? 'Academic conference paper presentation' :
                l === 3 ? 'Sister wedding ceremony outstation' :
                l === 4 ? 'Home visit with physical signed parent gate pass' :
                'Medical recuperation with doctor prescription',
        gatePassNo: `GP-${hConfig.code}-2026-${100 + l}`,
        parentConsentVerified: true,
        enteredByResidentialWardenId: hConfig.id === 'h-shivalik' ? 'usr-rw-shivalik' :
                                      hConfig.id === 'h-mandakini' ? 'usr-w-mandakini' : 'usr-rw-nilgiri',
        residentialWardenName: `${hConfig.warden} (Warden)`,
        createdAt: '2026-10-25 11:00 IST',
        notes: 'Parent telephonically verified. Automated absence alerts suppressed per FR-11.'
      });
    }
  }
});

export const todayDate = '2026-10-27';

// Date-wise attendance for 7 dates: 2026-10-22 through 2026-10-28
// For EACH hostel on EACH date:
// Attendance counts below define sample punches and leave records; remaining students are marked absent.
export const initialAttendance: AttendanceRecord[] = [];
const historyDates = [
  '2026-10-22',
  '2026-10-23',
  '2026-10-24',
  '2026-10-25',
  '2026-10-26',
  '2026-10-27',
  '2026-10-28'
];

// Distinct, non-uniform distribution across each day for realistic trend lines
// On Oct 27, it exactly hits the user requested numbers: 80 Present, 10 Late, 5 Leave, 5 Defaulters
const historyDateDistributions: Record<string, Record<string, { present: number; late: number; leave: number; defaulters: number }>> = {
  '2026-10-22': {
    'h-shivalik': { present: 87, late: 6, leave: 4, defaulters: 3 },
    'h-mandakini': { present: 89, late: 5, leave: 4, defaulters: 2 },
    'h-nilgiri': { present: 85, late: 7, leave: 5, defaulters: 3 }
  },
  '2026-10-23': {
    'h-shivalik': { present: 73, late: 16, leave: 4, defaulters: 7 },
    'h-mandakini': { present: 78, late: 13, leave: 5, defaulters: 4 },
    'h-nilgiri': { present: 74, late: 15, leave: 5, defaulters: 6 }
  },
  '2026-10-24': {
    'h-shivalik': { present: 84, late: 8, leave: 5, defaulters: 3 },
    'h-mandakini': { present: 85, late: 8, leave: 5, defaulters: 2 },
    'h-nilgiri': { present: 81, late: 10, leave: 6, defaulters: 3 }
  },
  '2026-10-25': {
    'h-shivalik': { present: 68, late: 15, leave: 11, defaulters: 6 },
    'h-mandakini': { present: 72, late: 12, leave: 12, defaulters: 4 },
    'h-nilgiri': { present: 70, late: 14, leave: 10, defaulters: 6 }
  },
  '2026-10-26': {
    'h-shivalik': { present: 83, late: 9, leave: 4, defaulters: 4 },
    'h-mandakini': { present: 86, late: 7, leave: 4, defaulters: 3 },
    'h-nilgiri': { present: 82, late: 9, leave: 5, defaulters: 4 }
  },
  '2026-10-27': {
    'h-shivalik': { present: 80, late: 10, leave: 5, defaulters: 5 },
    'h-mandakini': { present: 80, late: 10, leave: 5, defaulters: 5 },
    'h-nilgiri': { present: 80, late: 10, leave: 5, defaulters: 5 }
  },
  '2026-10-28': {
    'h-shivalik': { present: 85, late: 8, leave: 3, defaulters: 4 },
    'h-mandakini': { present: 88, late: 6, leave: 4, defaulters: 2 },
    'h-nilgiri': { present: 83, late: 9, leave: 4, defaulters: 4 }
  }
};

historyDates.forEach((date) => {
  hostelConfigs.forEach((hConfig) => {
    const hostelStudents = initialStudents.filter((s) => s.hostelId === hConfig.id);
    const device = initialBiometricDevices.find((d) => d.hostelId === hConfig.id);
    const dist = historyDateDistributions[date]?.[hConfig.id] || { present: 80, late: 10, leave: 5, defaulters: 5 };

    const limitPresent = dist.present;
    const limitLate = limitPresent + dist.late;
    const limitLeave = limitLate + dist.leave;

    hostelStudents.forEach((student, idx) => {
      // Present on-time
      if (idx < limitPresent) {
        const hour = 17 + Math.floor((idx % 60) / 50);
        const min = 15 + (idx % 45);
        const sec = (idx * 7) % 60;
        initialAttendance.push({
          id: `att-${student.id}-${date.replace(/-/g, '')}`,
          studentId: student.id,
          enrollmentNo: student.enrollmentNo,
          studentName: student.name,
          hostelId: student.hostelId,
          block: student.block,
          roomNumber: student.roomNumber,
          date,
          status: 'present',
          punchTime: `${hour}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`,
          biometricDeviceId: device?.id || 'bdev-main',
          isDefaulter: false,
          evaluatedAt: `${date} 22:00:05 IST`
        });
      }
      // Late punch (after 7:00 PM through 10:00 PM)
      else if (idx < limitLate) {
        const minutesAfterCutoff = 1 + ((idx - limitPresent) * 13) % 180;
        const hour = 19 + Math.floor(minutesAfterCutoff / 60);
        const min = minutesAfterCutoff % 60;
        initialAttendance.push({
          id: `att-${student.id}-${date.replace(/-/g, '')}`,
          studentId: student.id,
          enrollmentNo: student.enrollmentNo,
          studentName: student.name,
          hostelId: student.hostelId,
          block: student.block,
          roomNumber: student.roomNumber,
          date,
          status: 'late',
          punchTime: `${hour}:${String(min).padStart(2, '0')}:24`,
          biometricDeviceId: device?.id || 'bdev-main',
          isDefaulter: false,
          evaluatedAt: `${date} 22:00:05 IST`,
          remarks: 'Late entry after 7:00 PM and by the 10:00 PM IST cutoff.'
        });
      }
      // Approved Leave
      else if (idx < limitLeave) {
        initialAttendance.push({
          id: `att-${student.id}-${date.replace(/-/g, '')}`,
          studentId: student.id,
          enrollmentNo: student.enrollmentNo,
          studentName: student.name,
          hostelId: student.hostelId,
          block: student.block,
          roomNumber: student.roomNumber,
          date,
          status: 'approved_leave',
          isDefaulter: false,
          evaluatedAt: `${date} 22:00:05 IST`,
          remarks: `Approved leave authorized by ${hConfig.warden}. Email alerts suppressed (FR-11).`
        });
      }
      // Defaulter / absent at the 10:00 PM IST evaluation
      else {
        initialAttendance.push({
          id: `att-${student.id}-${date.replace(/-/g, '')}`,
          studentId: student.id,
          enrollmentNo: student.enrollmentNo,
          studentName: student.name,
          hostelId: student.hostelId,
          block: student.block,
          roomNumber: student.roomNumber,
          date,
          status: 'absent',
          isDefaulter: true,
          evaluatedAt: `${date} 22:00:05 IST`,
          remarks: 'No biometric punch recorded by the 10:00 PM IST evaluation. Flagged by scheduler.'
        });
      }
    });
  });
});

// 6-Tier Notification Escalation Logs for Defaulters on 2026-10-27
// 5 defaulters per hostel * 3 hostels = 15 defaulters, each escalated through 6 tiers
export const initialNotifications: NotificationLog[] = [];
hostelConfigs.forEach((hConfig) => {
  const defaulterStudents = initialStudents.filter((s) => s.hostelId === hConfig.id).slice(95, 100);

  defaulterStudents.forEach((student, idx) => {
    // Tier 1: Residential Warden
    initialNotifications.push({
      id: `notif-${student.id}-t1`,
      date: '2026-10-27',
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 1,
      recipientRole: 'Residential Warden',
      recipientName: hConfig.warden,
      recipientEmail: `${hConfig.code.toLowerCase()}.warden@university.edu.in`,
      status: 'delivered',
      timestamp: '2026-10-27 22:00:05 IST',
      retryCount: 0
    });
    // Tier 2: Warden
    initialNotifications.push({
      id: `notif-${student.id}-t2`,
      date: '2026-10-27',
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 2,
      recipientRole: 'Hostel Warden',
      recipientName: hConfig.warden,
      recipientEmail: `${hConfig.code.toLowerCase()}.warden@university.edu.in`,
      status: 'delivered',
      timestamp: '2026-10-27 22:00:30 IST',
      retryCount: 0
    });
    // Tier 3: Chief Warden (Prof. Sameer Varma)
    initialNotifications.push({
      id: `notif-${student.id}-t3`,
      date: '2026-10-27',
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 3,
      recipientRole: 'Chief Warden',
      recipientName: 'Prof. Sameer Varma',
      recipientEmail: 'chiefwarden@university.edu.in',
      status: 'delivered',
      timestamp: '2026-10-27 22:01:00 IST',
      retryCount: 0
    });
    // Tier 4: Director Sir
    initialNotifications.push({
      id: `notif-${student.id}-t4`,
      date: '2026-10-27',
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 4,
      recipientRole: 'Director',
      recipientName: 'Prof. R. K. Agrawal',
      recipientEmail: 'director@university.edu.in',
      status: 'delivered',
      timestamp: '2026-10-27 22:01:30 IST',
      retryCount: 0
    });
    // Tier 5: Parent
    initialNotifications.push({
      id: `notif-${student.id}-t5`,
      date: '2026-10-27',
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 5,
      recipientRole: "Student's Parent",
      recipientName: student.parentName,
      recipientEmail: student.parentEmail,
      status: idx === 4 ? 'failed' : 'delivered',
      failureReason: idx === 4 ? 'Parent email bounced: Mailbox temporarily unavailable' : undefined,
      timestamp: '2026-10-27 22:02:00 IST',
      retryCount: idx === 4 ? 2 : 0
    });
    // Tier 6: Student
    initialNotifications.push({
      id: `notif-${student.id}-t6`,
      date: '2026-10-27',
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      hostelId: student.hostelId,
      tier: 6,
      recipientRole: 'Student',
      recipientName: student.name,
      recipientEmail: student.studentEmail,
      status: 'delivered',
      timestamp: '2026-10-27 22:02:30 IST',
      retryCount: 0
    });
  });
});

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'audit-001',
    timestamp: '2026-10-27 11:30:15 IST',
    action: 'LEAVE_ENTRY',
    performedByUserId: 'usr-rw-shivalik',
    performedByUserName: 'Dr. Sati Sir (Warden)',
    performedByUserRole: 'residential_warden',
    targetEntity: 'LeaveRecord',
    targetId: 'leave-bh1-1',
    details: 'Entered verified leave for Rahul Sharma for brother wedding from 2026-10-25 to 2026-10-29'
  },
  {
    id: 'audit-002',
    timestamp: '2026-10-27 18:45:00 IST',
    action: 'BIOMETRIC_SYNC',
    performedByUserId: 'usr-mr-mehra',
    performedByUserName: 'Mr. Vivek Mehra (CSE Dept)',
    performedByUserRole: 'caretaker_operator',
    targetEntity: 'BiometricDevice',
    targetId: 'bdev-shiv-01',
    details: 'Synchronized 450 local turnstile records from Boys Hostel 1 to central attendance ledger'
  },
  {
    id: 'audit-003',
    timestamp: '2026-10-27 22:00:05 IST',
    action: 'SCHEDULED_CUTOFF_EXECUTION',
    performedByUserId: 'system',
    performedByUserName: 'Automated 10:00 PM Scheduler',
    performedByUserRole: 'system',
    targetEntity: 'AttendanceRecord',
    targetId: 'all-hostels',
    details: 'No-punch evaluation ran at 10:00 PM IST. Flagged 5 defaulters in Boys Hostel 1, 5 in Girls Hostel, and 5 in Boys Hostel 2.'
  }
];

export const initialScheduledJobs: ScheduledJobLog[] = [
  {
    id: 'job-cutoff-20261027',
    jobName: '7:00 PM IST On-Time Attendance Cutoff',
    scheduledTime: '19:00 IST',
    executedAt: '2026-10-27 19:00:05 IST',
    completedAt: '2026-10-27 19:00:15 IST',
    dateEvaluated: '2026-10-27',
    status: 'completed',
    totalStudents: 450,
    presentCount: 240,
    lateCount: 30,
    leaveCount: 15,
    defaultersCount: 0,
    notificationsQueued: 0
  },
  {
    id: 'job-defaulter-20261027',
    jobName: '10:00 PM IST Automated Defaulter Escalation',
    scheduledTime: '22:00 IST',
    executedAt: '2026-10-27 22:00:00 IST',
    completedAt: '2026-10-27 22:01:30 IST',
    dateEvaluated: '2026-10-27',
    status: 'completed',
    totalStudents: 450,
    presentCount: 240,
    lateCount: 30,
    leaveCount: 15,
    defaultersCount: 15,
    notificationsQueued: 90
  }
];
