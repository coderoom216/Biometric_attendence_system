import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  quickLoginAsRole: (role: UserRole) => Promise<void>;
  quickLoginAsAccount: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('hostel_auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      if (!token) {
        setIsLoading(false);
        return;
      }
      const data = await apiService.getMe();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('hostel_auth_token');
      }
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem('hostel_auth_token');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiService.login(email, password);
      if (data.success && data.token) {
        localStorage.setItem('hostel_auth_token', data.token);
        setToken(data.token);
        setUser(data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const quickLoginAsRole = async (role: UserRole) => {
    const roleCredentials: Record<UserRole, { email: string; pass: string }> = {
      director: { email: 'director@university.edu.in', pass: 'director123' },
      chief_warden: { email: 'chiefwarden@university.edu.in', pass: 'chief123' },
      residential_warden: { email: 'rw.shivalik@university.edu.in', pass: 'rw123' },
      warden: { email: 'warden.mandakini@university.edu.in', pass: 'warden123' },
      caretaker_operator: { email: 'vmehra@university.edu.in', pass: 'mehra123' },
      student: { email: 'rahul.sharma@student.edu.in', pass: 'student123' }
    };

    const cred = roleCredentials[role];
    if (cred) {
      await login(cred.email, cred.pass);
    }
  };

  const quickLoginAsAccount = async (email: string) => {
    const accountCredentials: Record<string, string> = {
      'director@university.edu.in': 'director123',
      'chiefwarden@university.edu.in': 'chief123',
      'rw.shivalik@university.edu.in': 'rw123',
      'warden.mandakini@university.edu.in': 'warden123',
      'rw.nilgiri@university.edu.in': 'pathak123',
      'vmehra@university.edu.in': 'mehra123',
      'rahul.sharma@student.edu.in': 'student123'
    };
    const password = accountCredentials[email];
    if (password) await login(email, password);
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('hostel_auth_token');
      localStorage.removeItem('demo_dashboard');
      setToken(null);
      setUser(null);
    }
  };

  const refreshProfile = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        quickLoginAsRole,
        quickLoginAsAccount,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
