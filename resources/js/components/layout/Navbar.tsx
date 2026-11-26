import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Sliders,
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
  const { user, logout } = useAuth();
  const [virtualTime, setVirtualTime] = useState<string>('19:15:00');
  const [virtualDate, setVirtualDate] = useState<string>('2026-10-27');
  const [isPastCutoff, setIsPastCutoff] = useState<boolean>(true);
  const [isWithinGraceWindow, setIsWithinGraceWindow] = useState<boolean>(true);
  const [isPastDefaulter, setIsPastDefaulter] = useState<boolean>(false);
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);

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
      case 'caretaker':
        return (
          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
            Hostel Caretaker
          </span>
        );
      case 'caretaker_operator':
        return (
          <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
            Biometric Device Manager
          </span>
        );
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
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-hidden shrink-0"
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Dual Partner Logos */}
              <div className="flex items-center space-x-1.5 shrink-0">
                <img
                  src="/images/thdc-ihet-logo.jpg"
                  alt="THDC IHET Logo"
                  className="h-10 w-10 sm:h-11 sm:w-11 rounded-full object-contain bg-white border border-slate-200 shadow-xs p-0.5"
                />
                <span className="text-[11px] font-bold text-slate-400 select-none">×</span>
                <img
                  src="/images/spiders-logo.jpg"
                  alt="SPIDERS TECH SERVICES Logo"
                  className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg object-contain bg-white border border-slate-200 shadow-xs p-0.5"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base truncate">
                    Hostel Attendance Portal
                  </span>
                  <span className="inline-flex text-[9px] sm:text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 shrink-0">
                    THDC IHET COLLABORATES WITH SPIDERS
                  </span>
                </div>
                <p className="hidden md:block text-[11px] text-slate-500 truncate">
                  THDC Institute of Hydropower Engineering &amp; Technology • Spiders Tech Services
                </p>
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
