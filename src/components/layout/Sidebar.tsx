import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  FileText,
  AlertOctagon,
  Cpu,
  Bell,
  ShieldCheck,
  Activity,
  UserCheck,
  UserPlus,
  BarChart3,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const role = user?.role;
  const isMehraDashboard = role === 'caretaker_operator' && localStorage.getItem('demo_dashboard') === 'mehra';
  const sidebarRole = isMehraDashboard ? 'mehra' : role;

  const getNavLinks = () => {
    switch (sidebarRole) {
      case 'student':
        return [
          { name: 'My Dashboard', path: '/', icon: LayoutDashboard },
          { name: 'My Attendance', path: '/attendance', icon: CalendarCheck },
          { name: 'My Approved Leaves', path: '/leaves', icon: FileText },
          { name: 'Registration Status', path: '/registration', icon: UserCheck }
        ];

      case 'residential_warden':
        return [
          { name: 'Dashboard', path: '/', icon: LayoutDashboard },
          { name: 'Student List', path: '/students', icon: Users },
          { name: 'Verify Registrations', path: '/students/verification', icon: UserCheck },
          { name: 'Defaulters List (10:00 PM)', path: '/defaulters', icon: AlertOctagon },
          { name: 'Enter Approved Leave', path: '/leaves', icon: FileText },
          { name: 'Assigned Hostel Rooms', path: '/hostels', icon: Building2 },
          { name: 'Reports & Exports', path: '/reports', icon: BarChart3 }
        ];

      case 'warden':
        return [
          { name: 'Hostel Dashboard', path: '/', icon: LayoutDashboard },
          { name: 'Student Directory', path: '/students', icon: Users },
          { name: 'Hostel Defaulters Roster', path: '/defaulters', icon: AlertOctagon },
          { name: 'Hostel & Room Capacity', path: '/hostels', icon: Building2 },
          { name: 'Approved Leaves', path: '/leaves', icon: FileText },
          { name: 'Daily Reports', path: '/reports', icon: BarChart3 },
          { name: 'Security Verification', path: '/security-audit', icon: ShieldCheck }
        ];

      case 'chief_warden':
        return [
          { name: 'Institution Oversight', path: '/', icon: LayoutDashboard },
          { name: 'All Hostels & Rooms', path: '/hostels', icon: Building2 },
          { name: 'All Students Directory', path: '/students', icon: Users },
          { name: 'Defaulter Summaries', path: '/defaulters', icon: AlertOctagon, highlight: true },
          { name: 'Leave & Correction Audits', path: '/leaves', icon: FileText },
          { name: 'Consolidated Reports', path: '/reports', icon: BarChart3 },
        ];

      case 'director':
        return [
          { name: 'Director Dashboard', path: '/', icon: LayoutDashboard },
          { name: 'Defaulters Overview', path: '/defaulters', icon: AlertOctagon, highlight: true },
          { name: 'Consolidated Daily Reports', path: '/reports', icon: BarChart3 },
          { name: 'Master Student Directory', path: '/students', icon: Users },
          { name: 'Hostel & Block Allocations', path: '/hostels', icon: Building2 },
          { name: '6-Tier Email Alerts Log', path: '/system-health', icon: Bell },

        ];

      case 'mehra':
        return [
          { name: 'Mehra Sir Dashboard', path: '/', icon: LayoutDashboard },
          { name: 'System & Device Health', path: '/system-health', icon: Activity },
        
          
        ];

      case 'caretaker_operator':
        return [
          { name: 'Operator Dashboard', path: '/', icon: LayoutDashboard },
          { name: 'Biometric Device Health', path: '/biometrics', icon: Cpu, highlight: true },
          { name: 'Student Biometric Directory', path: '/students', icon: Users },
          
          { name: 'Hostel Rooms & Vacancies', path: '/hostels', icon: Building2 },
          
        ];

        

      default:
        return [{ name: 'Dashboard', path: '/', icon: LayoutDashboard }];
    }
  };

  const navLinks = getNavLinks();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:flex-shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand in Sidebar */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
              HA
            </div>
            <div className="font-bold text-white text-sm tracking-wide">
              Hostel Attendance
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
            v2.1
          </span>
        </div>

        {/* Role Scope Notice */}
        <div className="sticky top-0 z-10 px-4 py-3 mx-3 my-3 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs backdrop-blur-sm">
          <div className="text-[10px] uppercase font-semibold text-slate-400">{isMehraDashboard ? 'Operator' : 'Current Scope'}</div>
          <div className="font-semibold text-white mt-0.5 capitalize">
            {isMehraDashboard ? 'Mr. Mehra Sir · Biometric Sync' : role?.replace('_', ' ')}
          </div>
          {user?.hostelId && (
            <div className="text-[11px] text-indigo-300 mt-0.5">
              Assigned: {user.hostelId === 'h-shivalik' ? 'Boys Hostel 1' : user.hostelId === 'h-mandakini' ? 'Girls Hostel' : 'BH-2 (Boys Hostel 2)'}
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navLinks.map((item) => (
            <NavLink
              key={item.path + item.name}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <div className="flex items-center space-x-3">
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </div>
              {item.highlight && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Directive & Institutional badge */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/40">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold mb-1">
            {isMehraDashboard ? <Cpu className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{isMehraDashboard ? 'Biometric Operations' : "Director's Directive"}</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            {isMehraDashboard
              ? 'Sync offline terminal punches and maintain verified student biometric records.'
              : '7:00 PM IST Attendance Cutoff. Sequentially escalated absence notifications to 6 tiers.'}
          </p>
        </div>
      </aside>
    </>
  );
};
