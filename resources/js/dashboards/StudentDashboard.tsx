import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Award,
  Ban,
  CalendarCheck,
  Clock,
  History,
  Home,
  FileText,
  AlertCircle,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import {
  DisciplinaryCardStatus,
  InstitutionalHoliday,
  LeaveRecord,
  AttendanceRecord,
  SemesterSettings,
  Student,
  StudentTokenSummary,
} from '../types';
import { StudentLeaveApplicationSection } from '../components/dashboard/StudentLeaveApplicationSection';

const disciplinaryStatusLabels: Record<DisciplinaryCardStatus, string> = {
  none: 'Good Standing',
  normal_warning: 'Normal Warning',
  yellow_card: 'Yellow Card',
  red_card_blacklist: 'Red Card + Blacklist'
};

const warningCardStages: { status: DisciplinaryCardStatus; label: string; range: string; startsAt: number }[] = [
  { status: 'normal_warning', label: 'Normal Warning', range: '1–5 tokens', startsAt: 1 },
  { status: 'yellow_card', label: 'Yellow Card', range: '6–10 tokens', startsAt: 6 },
  { status: 'red_card_blacklist', label: 'Red Card + Blacklist', range: 'More than 10 tokens', startsAt: 11 }
];

const getExpandedHolidayDates = (holidays: InstitutionalHoliday[], upToDate: string): Map<string, string> => {
  const map = new Map<string, string>();
  holidays.forEach((h) => {
    const start = new Date(`${h.startDate}T00:00:00Z`);
    const endCapStr = h.endDate < upToDate ? h.endDate : upToDate;
    const end = new Date(`${endCapStr}T00:00:00Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (!map.has(dateStr)) {
        map.set(dateStr, h.reason);
      }
    }
  });
  return map;
};

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Student | null>(null);
  const [disciplinary, setDisciplinary] = useState<StudentTokenSummary | null>(null);
  const [semester, setSemester] = useState<SemesterSettings | null>(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState<InstitutionalHoliday[]>([]);
  const [allHolidays, setAllHolidays] = useState<InstitutionalHoliday[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const [studentRes, attRes, leaveRes, semRes, holRes] = await Promise.allSettled([
        user?.studentId ? apiService.getStudentById(user.studentId) : Promise.resolve(null),
        apiService.getAttendanceHistory(),
        apiService.getMyLeaves(),
        apiService.getSemester(),
        apiService.getHolidays(),
      ]);

      if (studentRes.status === 'fulfilled' && studentRes.value?.success) {
        setProfile(studentRes.value.student);
        setDisciplinary(studentRes.value.disciplinary);
      }

      if (attRes.status === 'fulfilled' && attRes.value?.success) {
        setAttendance(attRes.value.records);
        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const today = attRes.value.records.find((r) => r.date === todayDate);
        setTodayRecord(today || null);
      }

      if (leaveRes.status === 'fulfilled' && Array.isArray(leaveRes.value?.leaves)) {
        setLeaves(leaveRes.value.leaves);
      }

      if (semRes.status === 'fulfilled' && semRes.value?.success) {
        setSemester(semRes.value.semester);
      }

      if (holRes.status === 'fulfilled' && holRes.value?.success) {
        setUpcomingHolidays(holRes.value.upcomingHolidays || []);
        setAllHolidays(holRes.value.holidays || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    const intervalId = window.setInterval(() => {
      loadData(false);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [user]);

  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const holidayDatesMap = getExpandedHolidayDates(allHolidays, todayIst);
  const todayHolidayReason = holidayDatesMap.get(todayIst);

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const lateCount = attendance.filter((a) => a.status === 'late').length;
  const leaveCount = attendance.filter((a) => a.status === 'approved_leave').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;

  const semesterTokenCount = disciplinary?.currentSemesterTokens ?? disciplinary?.currentMonthTokens ?? 0;
  const lifetimeTokenCount = disciplinary?.lifetimeTokens ?? 0;
  const currentStatus: DisciplinaryCardStatus = disciplinary?.disciplinaryStatus || 'none';
  const isBlacklisted = Boolean(disciplinary?.isBlacklisted);
  const semRangeLabel = semester
    ? `${semester.startDate} to ${semester.endDate}`
    : (disciplinary?.currentSemester || disciplinary?.currentMonth || 'Current Semester');

  const mergedAttendanceHistory = React.useMemo(() => {
    const existingDates = new Set(attendance.map((a) => a.date));
    const holidayEntries: Array<AttendanceRecord & { isHoliday?: boolean }> = [];
    holidayDatesMap.forEach((reason, date) => {
      if (!existingDates.has(date)) {
        holidayEntries.push({
          id: `holiday-${date}`,
          studentId: profile?.id || '',
          enrollmentNo: profile?.enrollmentNo || '',
          studentName: profile?.name || user?.name || '',
          hostelId: profile?.hostelId || '',
          block: profile?.block || '',
          roomNumber: profile?.roomNumber || '',
          date,
          status: 'present',
          isDefaulter: false,
          remarks: `Official Holiday: ${reason}`,
          isHoliday: true,
        });
      }
    });

    return [...attendance.map((a) => ({ ...a, isHoliday: false })), ...holidayEntries]
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, holidayDatesMap, profile, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="text-sm text-slate-500 font-medium">Loading student records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Student Welcome & Status Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold text-slate-900">{user?.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Verified Resident
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enrollment No: <strong className="text-slate-800">{profile?.enrollmentNo || '21BCSE101'}</strong> • Course: {profile?.course || 'B.Tech CSE'} • Biometric ID: {profile?.biometricId || 'BIO-1001'}
          </p>
        </div>

        {/* Today's Punch Badge */}
        <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <div className="text-[11px] uppercase font-semibold text-slate-500">Today's Attendance Status</div>
            <div className="text-sm font-bold flex items-center space-x-1.5">
              {todayRecord?.status === 'present' ? (
                <span className="text-emerald-700 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1 inline" /> Present (Punched at {todayRecord.punchTime} IST)
                </span>
              ) : todayRecord?.status === 'late' ? (
                <span className="text-amber-700 flex items-center">
                  <Clock className="w-4 h-4 mr-1 inline" /> Late Entry ({todayRecord.punchTime} IST)
                </span>
              ) : todayRecord?.status === 'approved_leave' ? (
                <span className="text-blue-700 flex items-center">
                  <FileText className="w-4 h-4 mr-1 inline" /> Approved Leave (Alerts Suppressed)
                </span>
              ) : todayRecord?.isDefaulter ? (
                <span className="text-rose-700 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1 inline" /> Flagged Defaulter
                </span>
              ) : todayHolidayReason ? (
                <span className="text-indigo-700">Official Holiday ({todayHolidayReason})</span>
              ) : (
                <span className="text-slate-600">Pending biometric punch (Cutoff: 7:30 PM IST)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Present</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{presentCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Punched before 7:30 PM</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Late</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{lateCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">7:30 PM through 10:00 PM IST</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Approved Leaves</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{leaveCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Entered by Residential Warden</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Absences / Defaulters</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{absentCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">After 10:00 PM or no punch by 10:00 PM</div>
        </div>
      </div>

      {disciplinary && (
        <section className={`rounded-2xl border p-5 shadow-xs sm:p-6 ${isBlacklisted ? 'border-rose-300 bg-rose-50/70' : 'border-slate-200 bg-white'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldAlert className={`h-5 w-5 ${isBlacklisted ? 'text-rose-600' : 'text-indigo-600'}`} />
                <h2>Token &amp; Disciplinary Management</h2>
              </div>
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Active semester: <strong>{semRangeLabel}</strong>. Warnings use attendance events in this date range.
              </p>
            </div>
            {isBlacklisted && (
              <div role="status" className="inline-flex items-center gap-2 self-start rounded-lg border-2 border-rose-600 bg-rose-600 px-4 py-2 text-sm font-black tracking-widest text-white shadow-sm">
                <Ban className="h-5 w-5" />
                BLACKLISTED
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current Semester Tokens</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">{semesterTokenCount}</span>
                <span className="text-xs text-slate-500">tokens</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-mono">{semRangeLabel}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lifetime Tokens</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">{lifetimeTokenCount}</span>
                <span className="text-xs text-slate-500">tokens</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Across all recorded semesters</div>
            </div>
            <div className={`rounded-xl border p-4 ${isBlacklisted ? 'border-rose-200 bg-white' : 'border-indigo-100 bg-indigo-50/60'}`}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current Disciplinary Status</div>
              <div className={`mt-2 flex items-center gap-2 text-base font-bold ${isBlacklisted ? 'text-rose-700' : currentStatus === 'yellow_card' ? 'text-amber-700' : currentStatus === 'normal_warning' ? 'text-orange-700' : 'text-emerald-700'}`}>
                {isBlacklisted ? <Ban className="h-5 w-5" /> : <Award className="h-5 w-5" />}
                {disciplinaryStatusLabels[currentStatus]}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Based on active-semester tokens</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {warningCardStages.map((stage) => {
              const isCurrent =
                (stage.status === 'normal_warning' && semesterTokenCount >= 1 && semesterTokenCount <= 5) ||
                (stage.status === 'yellow_card' && semesterTokenCount >= 6 && semesterTokenCount <= 10) ||
                (stage.status === 'red_card_blacklist' && isBlacklisted);
              const hasBeenReached = semesterTokenCount >= stage.startsAt;
              const stageTone = stage.status === 'normal_warning'
                ? 'border-orange-200 bg-orange-50 text-orange-800'
                : stage.status === 'yellow_card'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800';

              return (
                <div key={stage.status} className={`rounded-xl border p-3 ${stageTone} ${isCurrent ? 'ring-2 ring-offset-1 ring-current' : 'opacity-75'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">{stage.label}</span>
                    {isCurrent && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase">Current</span>}
                  </div>
                  <div className="mt-1 text-[11px]">{stage.range}</div>
                  {!isCurrent && <div className="mt-1 text-[10px]">{hasBeenReached ? 'Reached this semester' : 'Not reached'}</div>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            One token is added for each attendance defaulter within the active semester. Semester warning totals use the dates set by the Chief Warden; token history from other date ranges remains on record.
          </p>
        </section>
      )}

      {/* Student Hostel & Room Profile Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs md:col-span-1 space-y-3">
          <div className="flex items-center space-x-2 text-indigo-700 font-bold text-sm border-b border-slate-100 pb-2">
            <Home className="w-4 h-4" />
            <span>Hostel & Room Allocation</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Hostel:</span>
              <span className="font-semibold text-slate-800">
                {profile?.hostelId === 'h-shivalik' ? 'Boys Hostel 1' : profile?.hostelId === 'h-mandakini' ? 'Girls Hostel' : 'Boys Hostel 2'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Block / Floor:</span>
              <span className="font-semibold text-slate-800">{profile?.block || 'Block A'}, 1st Floor</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Room Number:</span>
              <span className="font-semibold text-slate-800">Room {profile?.roomNumber || '101'} (Bed {profile?.bedNumber || 'A'})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Parent/Guardian:</span>
              <span className="font-semibold text-slate-800">{profile?.parentName || 'Mr. Satish Sharma'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Parent Email (Alerts):</span>
              <span className="font-semibold text-slate-800">{profile?.parentEmail || 'satish.sharma@example.com'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Verification Status:</span>
              <span className="text-emerald-700 font-bold">Formally Verified by Warden</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 leading-snug">
            <strong>Director's Directive:</strong> Punches from 7:30 PM through 10:00 PM IST are marked Late; punches after 10:00 PM are defaulters. Students without a punch are flagged at the 10:00 PM IST evaluation, and sequential notifications are dispatched to Residential Warden, Warden, Chief Warden, Director Sir, and your Parents.
          </div>
        </div>

        {/* Personal Attendance Records Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs md:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
              <CalendarCheck className="w-4 h-4 text-indigo-600" />
              <span>My Personal Attendance History</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Isolated to student ID ({profile?.enrollmentNo})</span>
          </div>

          {semester && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-slate-800">Active Semester</div>
                <div className="font-mono text-slate-600 mt-0.5">{semester.startDate} to {semester.endDate}</div>
              </div>
              <span className="text-slate-500 font-semibold">{semester.durationDays} days</span>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs space-y-1.5">
            <div className="font-bold text-slate-800">Official Holidays &amp; Days Off</div>
            {upcomingHolidays.length === 0 ? (
              <p className="text-slate-600">No current or upcoming official holidays are scheduled.</p>
            ) : (
              <ul className="space-y-1 text-slate-700">
                {upcomingHolidays.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white border border-slate-200 px-2.5 py-1.5">
                    <span className="font-mono font-semibold text-indigo-700">
                      {h.startDate === h.endDate ? h.startDate : `${h.startDate} to ${h.endDate}`}
                    </span>
                    <span className="text-slate-700">{h.reason}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-500">
              Past holidays leave this upcoming list automatically. You can still see past holiday dates in your attendance history.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Punch Time</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mergedAttendanceHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-800">{rec.date}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {rec.punchTime ? `${rec.punchTime} IST` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {rec.isHoliday ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                          Official Holiday
                        </span>
                      ) : (
                        <>
                          {rec.status === 'present' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Present
                            </span>
                          )}
                          {rec.status === 'late' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                              Late Punch
                            </span>
                          )}
                          {rec.status === 'approved_leave' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                              Approved Leave
                            </span>
                          )}
                          {rec.status === 'absent' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                              Defaulter
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {rec.remarks || (rec.status === 'present' ? 'Turnstile biometric verified' : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Student Leave Application & Status Section */}
      <StudentLeaveApplicationSection
        profile={profile}
        studentName={user?.name || 'Student'}
        leaves={leaves}
        onSubmitted={() => loadData(false)}
      />
    </div>
  );
};

export const StudentDisciplinaryDashboard: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Student | null>(null);
  const [disciplinary, setDisciplinary] = useState<StudentTokenSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    if (!user?.studentId) {
      setErrorMessage('No student profile is linked to this account.');
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);
    setErrorMessage(null);
    apiService.getStudentById(user.studentId)
      .then((response) => {
        if (!isActive) return;
        setProfile(response.student);
        setDisciplinary(response.disciplinary);
      })
      .catch((error: unknown) => {
        console.error('Failed to load student disciplinary record:', error);
        if (isActive) setErrorMessage('Unable to load your token and disciplinary record. Please try again later.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [user?.studentId]);

  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Loading your disciplinary record...</div>
      </div>
    );
  }

  if (errorMessage || !disciplinary) {
    return (
      <div className="rounded-xl border border-rose-200 bg-white p-6 shadow-xs">
        <p className="text-sm font-semibold text-rose-700">{errorMessage || 'Disciplinary record is unavailable.'}</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
          <ArrowLeft className="h-4 w-4" />
          Back to My Dashboard
        </Link>
      </div>
    );
  }

  const discSemesterTokenCount = disciplinary?.currentSemesterTokens ?? disciplinary?.currentMonthTokens ?? 0;
  const discLifetimeTokenCount = disciplinary?.lifetimeTokens ?? 0;
  const discStatus: DisciplinaryCardStatus = disciplinary?.disciplinaryStatus || 'none';
  const discBlacklisted = Boolean(disciplinary?.isBlacklisted);
  const discSemesterRange = disciplinary?.currentSemester || disciplinary?.currentMonth || 'Active Semester';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            <ArrowLeft className="h-3.5 w-3.5" />
            Student Dashboard
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <ShieldAlert className="h-5 w-5 text-indigo-600" />
            Tokens &amp; Disciplinary Record
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {profile?.name} · {profile?.enrollmentNo} · {profile?.course}
          </p>
        </div>
        {discBlacklisted && (
          <div role="status" className="inline-flex items-center gap-2 self-start rounded-lg border-2 border-rose-600 bg-rose-600 px-4 py-2 text-sm font-black tracking-widest text-white shadow-sm sm:self-center">
            <Ban className="h-5 w-5" />
            BLACKLISTED
          </div>
        )}
      </div>

      <section className={`rounded-2xl border p-5 shadow-xs sm:p-6 ${discBlacklisted ? 'border-rose-300 bg-rose-50/70' : 'border-slate-200 bg-white'}`}>
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Active semester: <strong>{discSemesterRange}</strong>. Warnings use attendance events in this date range.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current Semester Tokens</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{discSemesterTokenCount}</span>
              <span className="text-xs text-slate-500">tokens</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 font-mono">{discSemesterRange}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lifetime Tokens</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{discLifetimeTokenCount}</span>
              <span className="text-xs text-slate-500">tokens</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Across all recorded semesters</div>
          </div>
          <div className={`rounded-xl border p-4 ${discBlacklisted ? 'border-rose-200 bg-white' : 'border-indigo-100 bg-indigo-50/60'}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current Disciplinary Status</div>
            <div className={`mt-2 flex items-center gap-2 text-base font-bold ${discBlacklisted ? 'text-rose-700' : discStatus === 'yellow_card' ? 'text-amber-700' : discStatus === 'normal_warning' ? 'text-orange-700' : 'text-emerald-700'}`}>
              {discBlacklisted ? <Ban className="h-5 w-5" /> : <Award className="h-5 w-5" />}
              {disciplinaryStatusLabels[discStatus]}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Based on active-semester tokens</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {warningCardStages.map((stage) => {
            const isCurrent =
              (stage.status === 'normal_warning' && discSemesterTokenCount >= 1 && discSemesterTokenCount <= 5) ||
              (stage.status === 'yellow_card' && discSemesterTokenCount >= 6 && discSemesterTokenCount <= 10) ||
              (stage.status === 'red_card_blacklist' && discBlacklisted);
            const hasBeenReached = discSemesterTokenCount >= stage.startsAt;
            const stageTone = stage.status === 'normal_warning'
              ? 'border-orange-200 bg-orange-50 text-orange-800'
              : stage.status === 'yellow_card'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-rose-200 bg-rose-50 text-rose-800';

            return (
              <div key={stage.status} className={`rounded-xl border p-3 ${stageTone} ${isCurrent ? 'ring-2 ring-offset-1 ring-current' : 'opacity-75'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{stage.label}</span>
                  {isCurrent && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase">Current</span>}
                </div>
                <div className="mt-1 text-[11px]">{stage.range}</div>
                {!isCurrent && <div className="mt-1 text-[10px]">{hasBeenReached ? 'Reached this semester' : 'Not reached'}</div>}
              </div>
            );
          })}
        </div>

        {discBlacklisted && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-white p-3 text-xs leading-relaxed text-rose-800">
            <Ban className="mt-0.5 h-4 w-4 shrink-0" />
            <p><strong>Semester blacklist active.</strong> Your active semester total is above 10 tokens. Token history from other date ranges remains on record.</p>
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          One token is added for each attendance defaulter within the active semester. Semester warning totals use the dates set by the Chief Warden; token history from other date ranges remains on record.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <History className="h-4 w-4 text-indigo-600" />
            <h2>Token History</h2>
          </div>
          <span className="text-xs text-slate-500">Previous months remain in your profile after monthly reset.</span>
        </div>

        {disciplinary.history.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No tokens have been recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Reason</th>
                  <th className="px-3 py-2.5">Tokens Received</th>
                  <th className="px-3 py-2.5">Warning Card Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {disciplinary.history.map((entry) => (
                  <tr key={entry.id} className="align-top hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-700">{entry.date}</td>
                    <td className="px-3 py-3 text-slate-600">{entry.reason}</td>
                    <td className="px-3 py-3 font-semibold text-slate-800">+{entry.tokensReceived}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${entry.warningCardStatus === 'red_card_blacklist' ? 'bg-rose-100 text-rose-800' : entry.warningCardStatus === 'yellow_card' ? 'bg-amber-100 text-amber-800' : entry.warningCardStatus === 'normal_warning' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600'}`}>
                        {disciplinaryStatusLabels[entry.warningCardStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
