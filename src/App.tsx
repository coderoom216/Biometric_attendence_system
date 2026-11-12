import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';

// Dashboards
import { StudentDashboard } from './dashboards/StudentDashboard';
import { ResidentialWardenDashboard } from './dashboards/ResidentialWardenDashboard';
import { WardenDashboard } from './dashboards/WardenDashboard';
import { ChiefWardenDashboard } from './dashboards/ChiefWardenDashboard';
import { DirectorDashboard } from './dashboards/DirectorDashboard';
import { CaretakerBiometricDashboard } from './dashboards/CaretakerBiometricDashboard';
import { CaretakerDashboard } from './dashboards/CaretakerDashboard';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DefaultersPage } from './pages/DefaultersPage';
import { LeaveManagementPage } from './pages/LeaveManagementPage';
import { HostelManagementPage } from './pages/HostelManagementPage';
import { ReportsPage } from './pages/ReportsPage';
import { StudentsPage } from './pages/StudentsPage';
import { SecurityAuditPage } from './pages/SecurityAuditPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { StudentRegistrationPage } from './pages/StudentRegistrationPage';

const DashboardRouter: React.FC = () => {
  const { user } = useAuth();

  switch (user?.role) {
    case 'student':
      return <StudentDashboard />;
    case 'residential_warden':
      return <ResidentialWardenDashboard />;
    case 'warden':
      return <WardenDashboard />;
    case 'chief_warden':
      return <ChiefWardenDashboard />;
    case 'director':
      return <DirectorDashboard />;
    case 'caretaker_operator':
      if (localStorage.getItem('demo_dashboard') === 'caretaker') return <CaretakerDashboard />;
      return <CaretakerBiometricDashboard />;
    default:
      return <StudentDashboard />;
  }
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-800">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
        <main className="min-w-0 flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs text-slate-400 font-mono">Initializing Hostel Attendance System...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardRouter />} />
        <Route path="/attendance" element={<ReportsPage />} />
        <Route path="/defaulters" element={<DefaultersPage />} />
        <Route path="/leaves" element={<LeaveManagementPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/hostels" element={<HostelManagementPage />} />
        <Route path="/biometrics" element={<CaretakerBiometricDashboard />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/security-audit" element={<SecurityAuditPage />} />
        <Route path="/system-health" element={<SystemHealthPage />} />
        <Route path="/registration" element={<StudentRegistrationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AuthenticatedApp />
      </Router>
    </AuthProvider>
  );
}
