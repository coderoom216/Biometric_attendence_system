import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const { login, quickLoginAsRole, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forgot password modal
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Authentication failed: Invalid credentials');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiService.forgotPassword(forgotEmail);
      setForgotMsg(res.message);
    } catch (err: any) {
      setForgotMsg(err.response?.data?.message || 'Password reset request failed');
    }
  };

  const demoAccounts = [
    { title: 'Student', email: 'rahul.sharma@student.edu.in', pass: 'student123', badge: 'Student' },
    { title: 'Residential Warden', email: 'rw.shivalik@university.edu.in', pass: 'rw123', badge: 'BH-1' },
    { title: 'Residential Warden', email: 'rw.nilgiri@university.edu.in', pass: 'pathak123', badge: 'BH-2' },
    { title: 'Residential Warden', email: 'warden.mandakini@university.edu.in', pass: 'warden123', badge: 'GH-1' },
    { title: 'Chief Warden', email: 'chiefwarden@university.edu.in', pass: 'chief123', badge: 'Chief Warden' },
    { title: 'Director Sir', email: 'director@university.edu.in', pass: 'director123', badge: 'Director' },
    { title: 'Caretaker / Biometrics', email: 'vmehra@university.edu.in', pass: 'mehra123', badge: 'Caretaker' },
    
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background architectural glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Institutional crest badge */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Building2 className="w-8 h-8" />
          </div>
        </div>

        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          Hostel Attendance Management System
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Spiders Student Development Team • Educational Institution Oversight
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-200">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Institutional Email or Username
              </label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@university.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-slate-900"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(true)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition disabled:opacity-50"
            >
              {isLoading ? 'Verifying Credentials...' : 'Sign In with Institutional Account'}
            </button>
          </form>

          {/* Quick Demo Selector for Reviewers & Stakeholders */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                1-Click Role Login (Demo & Audit)
              </span>
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                All 6 Roles
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => login(acc.email, acc.pass)}
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-left transition group cursor-pointer"
                >
                  <div className="font-semibold text-slate-800 text-[11px] group-hover:text-indigo-900 truncate">
                    {acc.title}
                  </div>
                  <div className="text-[10px] text-slate-500 group-hover:text-indigo-600 flex items-center justify-between">
                    <span>{acc.badge}</span>
                    <span className="text-[9px] text-slate-400 font-mono">1-click</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-2 text-[11px] text-slate-500">
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>On-time cutoff is 7:00 PM IST; late punches are accepted through 9:00 PM.</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-base mb-1">Institutional Password Recovery</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter your registered institutional email to initiate password recovery token dispatch.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <input
                type="email"
                required
                placeholder="name@university.edu.in"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />

              {forgotMsg && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-xs">
                  {forgotMsg}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsForgotOpen(false); setForgotMsg(null); }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  Send Recovery Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
