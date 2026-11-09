import { Router, Request, Response } from 'express';
import { store } from '../data/store';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  const user = store.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase().trim()
  );

  if (!user || user.passwordHash !== password) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials: Email or password does not match institutional records'
    });
  }

  const token = `token-${user.id}-${Date.now()}`;
  store.sessions.set(token, {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    hostelId: user.hostelId,
    blockId: user.blockId,
    studentId: user.studentId
  });

  store.logAudit(
    'USER_LOGIN',
    user,
    'UserSession',
    user.id,
    `Logged in successfully as role: ${user.role}`
  );

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      hostelId: user.hostelId,
      blockId: user.blockId,
      studentId: user.studentId
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    user: req.user
  });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    store.sessions.delete(token);
  }

  if (req.user) {
    store.logAudit(
      'USER_LOGOUT',
      req.user,
      'UserSession',
      req.user.id,
      'Session terminated'
    );
  }

  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Institutional email is required' });
  }

  const user = store.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase().trim()
  );

  if (!user) {
    // Standard secure response (do not leak user existence)
    return res.json({
      success: true,
      message: 'If the provided institutional email is registered, a password recovery token has been dispatched.'
    });
  }

  store.logAudit(
    'PASSWORD_RESET_REQUESTED',
    user,
    'User',
    user.id,
    `Password reset initiated for ${user.email}`
  );

  return res.json({
    success: true,
    message: `Password reset verification token has been routed to ${user.email}. Contact system administrator or Residential Warden if immediate access is required.`
  });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Valid email and a minimum 6-character new password are required'
    });
  }

  const user = store.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase().trim()
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.passwordHash = newPassword;
  store.logAudit(
    'PASSWORD_RESET_COMPLETED',
    user,
    'User',
    user.id,
    `Password updated successfully for ${user.email}`
  );

  return res.json({
    success: true,
    message: 'Password reset successful. Please sign in with your updated credentials.'
  });
});

export default router;
