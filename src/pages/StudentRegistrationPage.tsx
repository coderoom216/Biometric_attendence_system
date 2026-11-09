import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  CheckCircle2,
  Clock,
  Building2,
  ShieldAlert,
  Send,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Student } from '../types';

export const StudentRegistrationPage: React.FC = () => {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    enrollmentNo: '',
    name: user?.name || '',
    course: 'B.Tech Computer Science',
    hostelId: 'h-shivalik',
    block: 'Block A',
    roomNumber: '101',
    biometricId: '',
    parentName: '',
    parentEmail: '',
    parentPhone: ''
  });
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        if (user?.studentId) {
          const res = await apiService.getStudentById(user.studentId);
          if (res.success) {
            setStudent(res.student);
            setForm({
              enrollmentNo: res.student.enrollmentNo,
              name: res.student.name,
              course: res.student.course,
              hostelId: res.student.hostelId,
              block: res.student.block,
              roomNumber: res.student.roomNumber,
              biometricId: res.student.biometricId,
              parentName: res.student.parentName,
              parentEmail: res.student.parentEmail,
              parentPhone: res.student.parentPhone
            });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitFeedback(null);
    try {
      const res = await apiService.submitRegistration(form);
      if (res.success) {
        setSubmitFeedback('Registration submission forwarded to the Warden dashboard for formal review.');
        setStudent(res.student);
      }
    } catch (err: any) {
      setSubmitFeedback(err.response?.data?.message || 'Submission failed');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Student Registration & Verification Status</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${student?.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              Status: {student?.verificationStatus || 'Pending'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Institutional verification records per Director's Student Onboarding & Biometric Registration protocol.
          </p>
        </div>
      </div>

      {/* Institutional Directive Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-1">
        <div className="font-bold text-slate-900 flex items-center space-x-2">
          <UserCheck className="w-4 h-4 text-indigo-600" />
          <span>Director Sir's Directive on Student Data:</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Students do not directly modify authoritative master databases. Caretakers/Officials input verified profile details. Students submit registration data, which is formally reviewed and verified on the Warden dashboard before activation.
        </p>
      </div>

      {student && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="font-bold text-slate-900 text-sm border-b pb-3">Active Institutional Record</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400">Enrollment No:</span>
              <div className="font-bold font-mono text-slate-800 mt-0.5">{student.enrollmentNo}</div>
            </div>
            <div>
              <span className="text-slate-400">Student Full Name:</span>
              <div className="font-bold text-slate-800 mt-0.5">{student.name}</div>
            </div>
            <div>
              <span className="text-slate-400">Course / Semester:</span>
              <div className="font-medium text-slate-700 mt-0.5">{student.course} (Sem {student.semester})</div>
            </div>
            <div>
              <span className="text-slate-400">Biometric Credential ID:</span>
              <div className="font-bold font-mono text-indigo-700 mt-0.5">{student.biometricId}</div>
            </div>
            <div>
              <span className="text-slate-400">Hostel & Room:</span>
              <div className="font-medium text-slate-800 mt-0.5">
                {student.hostelId === 'h-shivalik' ? 'Boys Hostel 1' : student.hostelId === 'h-mandakini' ? 'Girls Hostel' : 'Boys Hostel 2'}, {student.block}, Room {student.roomNumber}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Parent / Guardian:</span>
              <div className="font-medium text-slate-800 mt-0.5">{student.parentName} ({student.parentEmail})</div>
            </div>
            <div>
              <span className="text-slate-400">Verified By:</span>
              <div className="text-emerald-700 font-semibold mt-0.5">{student.verifiedBy || 'Pending Formal Review'}</div>
            </div>
            <div>
              <span className="text-slate-400">Verification Timestamp:</span>
              <div className="font-mono text-slate-600 mt-0.5">{student.verifiedAt || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Submission Form for New Review */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="font-bold text-slate-900 text-sm border-b pb-3">
          Submit / Update Registration Details for Warden Verification
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Enrollment Number</label>
              <input
                type="text"
                required
                value={form.enrollmentNo}
                onChange={(e) => setForm({ ...form, enrollmentNo: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Full Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Hostel</label>
              <select
                value={form.hostelId}
                onChange={(e) => setForm({ ...form, hostelId: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="h-shivalik">Boys Hostel 1</option>
                <option value="h-mandakini">Girls Hostel</option>
                <option value="h-nilgiri">Boys Hostel 2</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Block</label>
              <input
                type="text"
                required
                value={form.block}
                onChange={(e) => setForm({ ...form, block: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Room No</label>
              <input
                type="text"
                required
                value={form.roomNumber}
                onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Parent/Guardian Name</label>
              <input
                type="text"
                required
                value={form.parentName}
                onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">Parent Email (For Absence Alerts)</label>
              <input
                type="email"
                required
                value={form.parentEmail}
                onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {submitFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
              {submitFeedback}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Registration Form for Warden Review</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
