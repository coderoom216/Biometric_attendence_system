import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Sliders,
  ChevronDown,
  Building2,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { ClockModal } from '../common/ClockModal';
import { UserRole } from '../../types';

interface NavbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  const { user, logout, quickLoginAsRole, quickLoginAsAccount } = useAuth();
  const [virtualTime, setVirtualTime] = useState<string>('19:15:00');
  const [virtualDate, setVirtualDate] = useState<string>('2026-10-27');
  const [isPastCutoff, setIsPastCutoff] = useState<boolean>(true);
  const [isWithinGraceWindow, setIsWithinGraceWindow] = useState<boolean>(true);
  const [isPastDefaulter, setIsPastDefaulter] = useState<boolean>(false);
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const fetchClock = async () => {
    try {
      const data = await apiService.getSchedulerStatus();
      if (data.success) {
        setVirtualTime(data.virtualTime);
        setVirtualDate(data.virtualDate);
        setIsPastCutoff(data.isPastCutoff);
        setIsWithinGraceWindow(data.isWithinGraceWindow);
        setIsPastDefaulter(data.isPastDefaulterTime);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchClock();
    const interval = setInterval(fetchClock, 10000);
    return () => clearInterval(interval);
  }, []);

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'director':
        return <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-purple-200">Director Sir</span>;
      case 'chief_warden':
        return <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">Chief Warden</span>;
      case 'residential_warden':
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">Residential Warden</span>;
      case 'warden':
        return <span className="bg-teal-100 text-teal-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-teal-200">Warden</span>;
      case 'caretaker_operator':
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">Mr. Mehra (Biometric)</span>;
      case 'student':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">Student</span>;
      default:
        return null;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Mobile hamburger & institutional brand */}
            <div className="flex items-center space-x-3">
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-hidden"
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-700 text-white flex items-center justify-center font-bold shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                      Hostel Attendance Portal
                    </span>
                    <span className="hidden sm:inline-flex text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                  
                    </span>
                  </div>
                  <p className="hidden md:block text-xs text-slate-500">
                    Institutional Attendance Management System
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Clock Simulator Pill, Switcher, and User Profile */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Virtual Clock Pill */}
              <button
                onClick={() => setIsClockModalOpen(true)}
                className="flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-mono transition shadow-xs hover:border-slate-300 bg-slate-50 border-slate-200 text-slate-700"
                title="Adjust the simulated clock or run 10:00 PM defaulter evaluation"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-bold hidden sm:inline">{virtualTime} IST</span>
                <span className="sm:hidden font-bold">{virtualTime.slice(0, 5)}</span>
                {isPastDefaulter ? (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                    10:00 PM Defaulter Check
                  </span>
                ) : isWithinGraceWindow ? (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                    Late Grace Window
                  </span>
                ) : isPastCutoff ? (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                    Awaiting 10:00 PM Check
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    Entry Open
                  </span>
                )}
                <Sliders className="w-3 h-3 text-slate-400 hidden md:inline ml-1" />
              </button>

              {/* Demo Role Switcher Quick Pill */}
              <div className="relative">
                <button
                  onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                  title="Switch Role for Verification"
                >
                  <span className="hidden sm:inline">Switch Role:</span>
                  <span className="font-semibold">{user?.role === 'caretaker_operator' && localStorage.getItem('demo_dashboard') === 'caretaker' ? 'Caretaker' : user?.role?.replace('_', ' ')}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showRoleDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      Switch Active Role
                    </div>
                    <button
                      onClick={() => { quickLoginAsRole('director'); setShowRoleDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-purple-50 text-slate-700 hover:text-purple-900 flex items-center justify-between"
                    >
                      <span>Dr. S.K Pradhan </span>
                      {user?.role === 'director' && <span className="text-purple-600 font-bold">✓</span>}
                    </button>
                    <button
                      onClick={() => { quickLoginAsRole('chief_warden'); setShowRoleDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 flex items-center justify-between"
                    >
                      <span>Prof. Sameer Varma (Chief Warden)</span>
                      {user?.role === 'chief_warden' && <span className="text-indigo-600 font-bold">✓</span>}
                    </button>
                    <button
                      onClick={() => { quickLoginAsRole('residential_warden'); setShowRoleDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-900 flex items-center justify-between"
                    >
                      <span>Mr. Sachin Sati  (Boys Hostel 1)</span>
                      {user?.role === 'residential_warden' && <span className="text-blue-600 font-bold">✓</span>}
                    </button>
                    <button
                      onClick={() => { quickLoginAsAccount('warden.mandakini@university.edu.in'); setShowRoleDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-teal-50 text-slate-700 hover:text-teal-900 flex items-center justify-between"
                    >
                      <span>Dr. Kavita Tariyal (Girls Hostel)</span>
                      {user?.email === 'warden.mandakini@university.edu.in' && <span className="text-teal-600 font-bold">✓</span>}
                    </button>
                    <button
                      onClick={() => { quickLoginAsAccount('rw.nilgiri@university.edu.in'); setShowRoleDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-teal-50 text-slate-700 hover:text-teal-900 flex items-center justify-between"
                    >
                      <span>Dr. Pathak Sir (Boys Hostel 2 · BH-2)</span>
                      {user?.email === 'rw.nilgiri@university.edu.in' && <span className="text-teal-600 font-bold">✓</span>}
                    </button>
                    <button
                      onClick={() => { localStorage.setItem('demo_dashboard', 'caretaker'); quickLoginAsRole('caretaker_operator'); setShowRoleDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-orange-50 text-slate-700 hover:text-orange-900 flex items-center justify-between"
                    >
                      <span>Caretaker (Attendance Dashboard)</span>
                      {user?.role === 'caretaker_operator' && localStorage.getItem('demo_dashboard') === 'caretaker' && <span className="text-orange-600 font-bold">✓</span>}
                    </button>
                    <button
                      onClick={() => { localStorage.setItem('demo_dashboard', 'mehra'); quickLoginAsRole('caretaker_operator'); setShowRoleDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 text-slate-700 hover:text-amber-900 flex items-center justify-between"
                    >
                      <span>Mr. Mehra (Biometric Sync)</span>
                      {user?.role === 'caretaker_operator' && localStorage.getItem('demo_dashboard') !== 'caretaker' && <span className="text-amber-600 font-bold">✓</span>}
                    </button>
                    <button
                      onClick={() => { quickLoginAsRole('student'); setShowRoleDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 flex items-center justify-between"
                    >
                      <span>Student (Rahul Sharma)</span>
                      {user?.role === 'student' && <span className="text-emerald-600 font-bold">✓</span>}
                    </button>
                  </div>
                )}
              </div>

              {/* User details & Logout */}
              <div className="flex items-center space-x-2 pl-1 border-l border-slate-200">
                <div className="hidden lg:block text-right">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {user?.name}
                  </div>
                  <div className="mt-0.5">{getRoleBadge(user?.role)}</div>
                </div>

                <button
                  onClick={logout}
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Logout Session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Clock Simulation Modal */}
      <ClockModal
        isOpen={isClockModalOpen}
        onClose={() => setIsClockModalOpen(false)}
        onClockUpdated={fetchClock}
        currentVirtualTime={virtualTime}
        currentVirtualDate={virtualDate}
      />
    </>
  );
};
