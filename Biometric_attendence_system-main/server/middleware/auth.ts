import { Request, Response, NextFunction } from 'express';
import { store } from '../data/store';
import { User, UserRole } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Unauthenticated: No authorization token provided'
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const user = store.sessions.get(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthenticated: Invalid or expired session token'
    });
  }

  req.user = user;
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted. Required role: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
      });
    }

    next();
  };
}

// Student record ownership validator (Prevents IDOR attacks)
export function requireStudentOwnership(paramKey = 'studentId') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthenticated' });

    // Privileged staff can access students within their scope
    if (['director', 'chief_warden', 'residential_warden', 'warden', 'caretaker_operator'].includes(user.role)) {
      return next();
    }

    // Student can only access their own studentId
    const targetStudentId = req.params[paramKey] || req.query[paramKey] || req.body[paramKey];
    if (user.role === 'student' && user.studentId !== targetStudentId) {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: You are not authorized to view or access another student\'s private record.'
      });
    }

    next();
  };
}

// Hostel scope validator for Wardens
export function requireHostelScope(paramKey = 'hostelId') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthenticated' });

    // Director and Chief Warden have institution-wide access
    if (user.role === 'director' || user.role === 'chief_warden' || user.role === 'caretaker_operator') {
      return next();
    }

    const targetHostelId = req.params[paramKey] || req.query[paramKey] || req.body[paramKey];
    if ((user.role === 'residential_warden' || user.role === 'warden') && user.hostelId && targetHostelId && user.hostelId !== targetHostelId) {
      return res.status(403).json({
        success: false,
        message: `Security Violation: Warden access restricted to assigned hostel (${user.hostelId}). Attempted to access unassigned hostel (${targetHostelId}).`
      });
    }

    next();
  };
}
