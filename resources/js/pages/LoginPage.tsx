import React, { useState } from 'react';
import {
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

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
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
    localStorage.removeItem('demo_dashboard');
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background architectural glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto w-full max-w-4xl relative z-10 px-4 sm:px-6 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Logos, Collaboration Text, and Institutional Overview */}
          <div className="lg:col-span-6 text-center lg:text-left space-y-4">
            {/* Dual Partner Logos */}
            <div className="flex items-center justify-center lg:justify-start space-x-3 sm:space-x-4">
              <div className="p-1.5 bg-white rounded-full shadow-xl border-2 border-indigo-400/30">
                <img
                  src="/images/thdc-ihet-logo.jpg"
                  alt="THDC IHET Logo"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-contain"
                />
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-indigo-400 font-extrabold text-xl sm:text-2xl select-none leading-none">×</span>
              </div>
              <div className="p-1.5 bg-white rounded-2xl shadow-xl border-2 border-indigo-400/30">
                <img
                  src="/images/spiders-logo.jpg"
                  alt="SPIDERS TECH SERVICES Logo"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain"
                />
              </div>
            </div>

            {/* Collaboration Banner */}
            <div className="flex justify-center lg:justify-start">
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-400/30 shadow-xs">
                THDC IHET COLLABORATES WITH SPIDERS
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Hostel Attendance Management System
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Institutional biometric attendance oversight, automated curfew enforcement, and multi-tier escalation management.
              </p>
            </div>

            <div className="hidden lg:block pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p>• THDC Institute of Hydropower Engineering &amp; Technology, Tehri Garhwal</p>
              <p>• Engineered &amp; Maintained in Collaboration with Spiders Tech Services</p>
            </div>
          </div>

          {/* Right Column: Sign-In Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto lg:max-w-none">
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

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center space-x-2 text-[11px] text-slate-500">
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>On-time cutoff is 7:00 PM IST; punches after 7:00 PM through 10:00 PM are late, and punches after 10:00 PM are defaulters. No-punch evaluation runs at 10:00 PM.</span>
          </div>
        </div>
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

export default LoginPage;
