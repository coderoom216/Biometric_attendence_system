import { Router, Response } from 'express';
import { store } from '../data/store';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/reports/summary (FR-09: Daily reports hostel-wise, block-wise, consolidated)
router.get(
  '/summary',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director', 'caretaker_operator']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const date = req.query.date ? String(req.query.date) : store.virtualDate;

    let hostels = store.hostels;
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
      hostels = hostels.filter((h) => h.id === user.hostelId);
    }

    const attendanceRecords = store.attendance.filter((a) => a.date === date);

    const hostelReports = hostels.map((hostel) => {
      const records = attendanceRecords.filter((a) => a.hostelId === hostel.id);
      const totalStudents = store.students.filter(
        (s) => s.hostelId === hostel.id && s.checkoutStatus === 'active' && s.verificationStatus === 'verified'
      ).length;

      const present = records.filter((r) => r.status === 'present').length;
      const late = records.filter((r) => r.status === 'late').length;
      const leave = records.filter((r) => r.status === 'approved_leave').length;
      const defaulters = records.filter((r) => r.isDefaulter).length;
      const absent = records.filter((r) => r.status === 'absent').length;

      // Block-wise breakdown
      const blockStats = hostel.blocks.map((blk) => {
        const blkRecords = records.filter((r) => r.block === blk);
        const blkStudents = store.students.filter(
          (s) => s.hostelId === hostel.id && s.block === blk && s.checkoutStatus === 'active' && s.verificationStatus === 'verified'
        ).length;

        return {
          block: blk,
          total: blkStudents,
          present: blkRecords.filter((r) => r.status === 'present').length,
          late: blkRecords.filter((r) => r.status === 'late').length,
          leave: blkRecords.filter((r) => r.status === 'approved_leave').length,
          defaulters: blkRecords.filter((r) => r.isDefaulter).length,
          complianceRate: blkStudents > 0 ? Math.round(((blkRecords.filter((r) => r.status === 'present' || r.status === 'late' || r.status === 'approved_leave').length) / blkStudents) * 100) : 0
        };
      });

      const complianceRate = totalStudents > 0 ? Math.round(((present + late + leave) / totalStudents) * 100) : 0;

      return {
        hostelId: hostel.id,
        hostelName: hostel.name,
        code: hostel.code,
        type: hostel.type,
        totalCapacity: hostel.capacity,
        totalEnrolled: totalStudents,
        present,
        late,
        leave,
        absent,
        defaulters,
        complianceRate,
        blockStats
      };
    });

    const consolidated = {
      totalHostels: hostelReports.length,
      totalEnrolled: hostelReports.reduce((sum, h) => sum + h.totalEnrolled, 0),
      totalPresent: hostelReports.reduce((sum, h) => sum + h.present, 0),
      totalLate: hostelReports.reduce((sum, h) => sum + h.late, 0),
      totalLeave: hostelReports.reduce((sum, h) => sum + h.leave, 0),
      totalDefaulters: hostelReports.reduce((sum, h) => sum + h.defaulters, 0),
      overallComplianceRate:
        hostelReports.reduce((sum, h) => sum + h.totalEnrolled, 0) > 0
          ? Math.round(
              (hostelReports.reduce((sum, h) => sum + h.present + h.late + h.leave, 0) /
                hostelReports.reduce((sum, h) => sum + h.totalEnrolled, 0)) *
                100
            )
          : 0
    };

    // Date-wise longitudinal trend generation for line charts across all hostels
    const trendDates = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];
    const dateWiseTrends = trendDates.map((d) => {
      const dRecords = store.attendance.filter((a) => a.date === d);
      const parts = d.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateLabel = `${monthNames[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;

      const hostelTrends = store.hostels.map((hostel) => {
        const hRecs = dRecords.filter((a) => a.hostelId === hostel.id);
        const enrolled = store.students.filter(
          (s) => s.hostelId === hostel.id && s.checkoutStatus === 'active' && s.verificationStatus === 'verified'
        ).length;
        const p = hRecs.filter((r) => r.status === 'present').length;
        const l = hRecs.filter((r) => r.status === 'late').length;
        const lv = hRecs.filter((r) => r.status === 'approved_leave').length;
        const def = hRecs.filter((r) => r.isDefaulter).length;
        const abs = hRecs.filter((r) => r.status === 'absent').length;

        return {
          hostelId: hostel.id,
          hostelName: hostel.name,
          code: hostel.code,
          enrolled,
          present: p,
          late: l,
          leave: lv,
          defaulters: def,
          absent: abs,
          totalAttended: p + l,
          complianceRate: enrolled > 0 ? Math.round(((p + l + lv) / enrolled) * 100) : 0
        };
      });

      const totalEnrolled = hostelTrends.reduce((acc, h) => acc + h.enrolled, 0);
      const totalPresent = hostelTrends.reduce((acc, h) => acc + h.present, 0);
      const totalLate = hostelTrends.reduce((acc, h) => acc + h.late, 0);
      const totalLeave = hostelTrends.reduce((acc, h) => acc + h.leave, 0);
      const totalDefaulters = hostelTrends.reduce((acc, h) => acc + h.defaulters, 0);

      return {
        date: d,
        label: dateLabel,
        hostels: hostelTrends,
        consolidated: {
          enrolled: totalEnrolled,
          present: totalPresent,
          late: totalLate,
          leave: totalLeave,
          defaulters: totalDefaulters,
          absent: totalDefaulters,
          totalAttended: totalPresent + totalLate,
          complianceRate: totalEnrolled > 0 ? Math.round(((totalPresent + totalLate + totalLeave) / totalEnrolled) * 100) : 0
        }
      };
    });

    return res.json({
      success: true,
      date,
      consolidated,
      hostelReports,
      dateWiseTrends
    });
  }
);

// GET /api/reports/trends (Date-wise longitudinal line graph telemetry)
router.get(
  '/trends',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director', 'caretaker_operator']),
  (_req: AuthenticatedRequest, res: Response) => {
    const trendDates = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const trends = trendDates.map((d) => {
      const dRecords = store.attendance.filter((a) => a.date === d);
      const parts = d.split('-');
      const dateLabel = `${monthNames[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;

      const hostelTrends = store.hostels.map((hostel) => {
        const hRecs = dRecords.filter((a) => a.hostelId === hostel.id);
        const enrolled = store.students.filter(
          (s) => s.hostelId === hostel.id && s.checkoutStatus === 'active' && s.verificationStatus === 'verified'
        ).length;
        const p = hRecs.filter((r) => r.status === 'present').length;
        const l = hRecs.filter((r) => r.status === 'late').length;
        const lv = hRecs.filter((r) => r.status === 'approved_leave').length;
        const def = hRecs.filter((r) => r.isDefaulter).length;

        return {
          hostelId: hostel.id,
          hostelName: hostel.name,
          code: hostel.code,
          enrolled,
          present: p,
          late: l,
          leave: lv,
          defaulters: def,
          absent: def,
          totalAttended: p + l,
          complianceRate: enrolled > 0 ? Math.round(((p + l + lv) / enrolled) * 100) : 0
        };
      });

      const totalEnrolled = hostelTrends.reduce((acc, h) => acc + h.enrolled, 0);
      const totalPresent = hostelTrends.reduce((acc, h) => acc + h.present, 0);
      const totalLate = hostelTrends.reduce((acc, h) => acc + h.late, 0);
      const totalLeave = hostelTrends.reduce((acc, h) => acc + h.leave, 0);
      const totalDefaulters = hostelTrends.reduce((acc, h) => acc + h.defaulters, 0);

      return {
        date: d,
        label: dateLabel,
        hostels: hostelTrends,
        consolidated: {
          enrolled: totalEnrolled,
          present: totalPresent,
          late: totalLate,
          leave: totalLeave,
          defaulters: totalDefaulters,
          absent: totalDefaulters,
          totalAttended: totalPresent + totalLate,
          complianceRate: totalEnrolled > 0 ? Math.round(((totalPresent + totalLate + totalLeave) / totalEnrolled) * 100) : 0
        }
      };
    });

    return res.json({
      success: true,
      trends
    });
  }
);

// GET /api/reports/export-defaulters-csv
router.get(
  '/export-defaulters-csv',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const date = req.query.date ? String(req.query.date) : store.virtualDate;

    let records = store.attendance.filter((a) => a.date === date && a.isDefaulter);

    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
      records = records.filter((a) => a.hostelId === user.hostelId);
    }

    let csv = 'Date,Enrollment No,Student Name,Hostel,Block,Room,Status,Evaluation Time,Remarks\n';
    for (const r of records) {
      const hostel = store.hostels.find((h) => h.id === r.hostelId)?.name || r.hostelId;
      csv += `"${r.date}","${r.enrollmentNo}","${r.studentName}","${hostel}","${r.block}","${r.roomNumber}","DEFAULTER","${r.evaluatedAt || ''}","${r.remarks || ''}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="hostel_defaulters_${date}.csv"`);
    return res.send(csv);
  }
);

// GET /api/reports/export-attendance-csv
router.get(
  '/export-attendance-csv',
  authenticate,
  requireRole(['residential_warden', 'warden', 'chief_warden', 'director']),
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const date = req.query.date ? String(req.query.date) : store.virtualDate;

    let records = store.attendance.filter((a) => a.date === date);

    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId) {
      records = records.filter((a) => a.hostelId === user.hostelId);
    }

    let csv = 'Date,Enrollment No,Student Name,Hostel,Block,Room,Punch Time,Status,Is Defaulter,Evaluated At,Remarks\n';
    for (const r of records) {
      const hostel = store.hostels.find((h) => h.id === r.hostelId)?.name || r.hostelId;
      csv += `"${r.date}","${r.enrollmentNo}","${r.studentName}","${hostel}","${r.block}","${r.roomNumber}","${r.punchTime || 'N/A'}","${r.status}","${r.isDefaulter ? 'YES' : 'NO'}","${r.evaluatedAt || ''}","${r.remarks || ''}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${date}.csv"`);
    return res.send(csv);
  }
);

export default router;
