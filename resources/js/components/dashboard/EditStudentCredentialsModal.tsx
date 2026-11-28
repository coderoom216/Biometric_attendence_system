import React, { useEffect, useState } from 'react';
import { Copy, Check, Eye, EyeOff, Key, X } from 'lucide-react';
import { apiService } from '../../services/api';
import { Student } from '../../types';

interface EditStudentCredentialsModalProps {
  student: Student | null;
  onClose: () => void;
  onSaved: (updatedStudent: Student, message: string) => void;
}

export const EditStudentCredentialsModal: React.FC<EditStudentCredentialsModalProps> = ({
  student,
  onClose,
  onSaved,
}) => {
  const [studentEmail, setStudentEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);
  const [isLoadingCreds, setIsLoadingCreds] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!student) return;
    let isCurrent = true;
    setStudentEmail(student.studentEmail || '');
    setCurrentPassword(student.loginPassword ?? null);
    setShowCurrentPassword(true);
    setPassword('');
    setShowPassword(false);
    setErrorMsg(null);
    setIsLoadingCreds(true);

    apiService
      .getStudentCredentials(student.id)
      .then((res) => {
        if (!isCurrent || !res?.success) return;
        setStudentEmail(res.credentials.studentEmail || student.studentEmail || '');
        setCurrentPassword(res.credentials.loginPassword ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (isCurrent) setIsLoadingCreds(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [student]);

  if (!student) {
    return null;
  }

  const handleCopy = async (value: string, field: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = studentEmail.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setErrorMsg('Student login email is required.');
      return;
    }

    if (trimmedPassword.length > 0 && trimmedPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiService.updateStudentCredentials(student.id, {
        studentEmail: trimmedEmail,
        password: trimmedPassword || undefined,
      });
      if (res.success) {
        onSaved(res.student, res.message || 'Student credentials updated successfully.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Unable to update student credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-credentials-title"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95"
      >
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" />
            <div>
              <h3 id="edit-student-credentials-title" className="font-semibold text-sm">
                View &amp; Change Student Credentials
              </h3>
              <p className="text-[11px] text-slate-300">
                {student.name} ({student.enrollmentNo}) · Room {student.roomNumber || '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close credentials modal"
            className="text-slate-400 hover:text-white p-1 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Current Stored Credentials View */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Current Login Credentials
            </div>
            <div className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded px-2.5 py-1.5">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 block">Current Email</span>
                <span className="font-mono font-semibold text-slate-900 break-all">{student.studentEmail}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(student.studentEmail, 'email')}
                className="shrink-0 p-1 text-slate-500 hover:text-indigo-700 cursor-pointer"
                title="Copy email"
              >
                {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded px-2.5 py-1.5">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 block">Current Password</span>
                {isLoadingCreds && currentPassword === null ? (
                  <span className="text-slate-400 font-mono">Loading...</span>
                ) : currentPassword ? (
                  <span className="font-mono font-bold text-slate-900">
                    {showCurrentPassword ? currentPassword : '••••••••'}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">
                    Custom password set earlier — enter a new password below to reset &amp; view
                  </span>
                )}
              </div>
              {currentPassword && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    className="p-1 text-slate-500 hover:text-indigo-700 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentPassword, 'password')}
                    className="p-1 text-slate-500 hover:text-indigo-700 cursor-pointer"
                    title="Copy password"
                  >
                    {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="cred-student-email" className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
              Student Login Email
            </label>
            <input
              id="cred-student-email"
              type="email"
              required
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg font-mono text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="cred-student-password" className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
              New Password (Optional)
            </label>
            <div className="relative">
              <input
                id="cred-student-password"
                type={showPassword ? 'text' : 'password'}
                minLength={6}
                placeholder="Leave blank to keep existing password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 pr-9 border border-slate-300 rounded-lg text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Minimum 6 characters if resetting password. Leave empty to change only the login email.
            </p>
          </div>

          {errorMsg && (
            <div role="alert" className="p-2.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : 'Save Credentials'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
