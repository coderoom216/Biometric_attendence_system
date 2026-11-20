import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Cpu, Users } from 'lucide-react';

export const CaretakerDashboard: React.FC = () => (
  <div className="space-y-6">
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Caretaker / Biometric</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Caretaker Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">Use the shortcuts below to manage hostel attendance and student records.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Link to="/biometrics" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:bg-indigo-50 transition">
        <Cpu className="h-6 w-6 text-indigo-600" />
        <h2 className="mt-3 font-semibold text-slate-900">Biometric terminal</h2>
        <p className="mt-1 text-sm text-slate-600">Sync device logs and check terminal status.</p>
      </Link>
      <Link to="/registration" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:bg-indigo-50 transition">
        <Users className="h-6 w-6 text-indigo-600" />
        <h2 className="mt-3 font-semibold text-slate-900">Student onboarding</h2>
        <p className="mt-1 text-sm text-slate-600">Register a student and link their biometric ID.</p>
      </Link>
      <Link to="/attendance" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:bg-indigo-50 transition">
        <ClipboardCheck className="h-6 w-6 text-indigo-600" />
        <h2 className="mt-3 font-semibold text-slate-900">Attendance reports</h2>
        <p className="mt-1 text-sm text-slate-600">Review attendance records and daily summaries.</p>
      </Link>
    </div>
  </div>
);
