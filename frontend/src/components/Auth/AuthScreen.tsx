import React, { useState } from 'react';
import {
  Compass,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type AuthMode = 'login' | 'signup';

export const AuthScreen: React.FC = () => {
  const { login, signup, isLoading, error, clearError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleTabChange = (newMode: AuthMode) => {
    setMode(newMode);
    setValidationError(null);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters long.');
      return;
    }

    if (mode === 'signup') {
      const cleanName = fullName.trim();
      if (!cleanName || cleanName.length < 2) {
        setValidationError('Please enter your full name (at least 2 characters).');
        return;
      }

      if (password !== confirmPassword) {
        setValidationError('Passwords do not match. Please re-enter.');
        return;
      }

      try {
        await signup(cleanName, cleanEmail, password);
      } catch {
        // Error is set in AuthContext
      }
    } else {
      try {
        await login(cleanEmail, password);
      } catch {
        // Error is set in AuthContext
      }
    }
  };

  const displayedError = validationError || error;

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center p-4 bg-radial from-blue-50/50 via-slate-50 to-slate-100 overflow-y-auto">
      <div className="w-full max-w-md my-auto">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex relative mb-3">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Compass size={30} />
            </div>
            <Sparkles size={16} className="absolute -top-1 -right-1 text-amber-500" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            CareerCompass AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Confidential, Evidence-Based AI Career Consultation
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/50 p-6 sm:p-8 backdrop-blur-xs">
          {/* Toggle Tab */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200/60">
            <button
              type="button"
              data-testid="tab-login"
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => handleTabChange('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              data-testid="tab-signup"
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => handleTabChange('signup')}
            >
              Create Account
            </button>
          </div>

          {/* Subtitle / Context */}
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              {mode === 'login' ? 'Welcome back' : 'Start your consultation'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'login'
                ? 'Sign in with your email to access saved roadmaps & conversations.'
                : 'Register as a student or parent. One account gives personalized guidance.'}
            </p>
          </div>

          {/* Error Alert */}
          {displayedError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200">
              <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{displayedError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <UserIcon size={16} className="absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 focus:outline-hidden transition-all placeholder:text-slate-400"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 focus:outline-hidden transition-all placeholder:text-slate-400"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                {mode === 'signup' && (
                  <span className="text-[10px] text-slate-400">Min 8 characters</span>
                )}
              </div>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 focus:outline-hidden transition-all placeholder:text-slate-400"
                  disabled={isLoading}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 focus:outline-hidden transition-all placeholder:text-slate-400"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-[11px] text-slate-600">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>Account role is set to <strong>User</strong> (Student / Parent access).</span>
              </div>
            )}

            <button
              type="submit"
              data-testid="auth-submit-btn"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{mode === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Consultation' : 'Complete Registration'}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  className="font-semibold text-blue-600 hover:underline cursor-pointer"
                  onClick={() => handleTabChange('signup')}
                >
                  Create Account
                </button>
              </p>
            ) : (
              <p>
                Already registered?{' '}
                <button
                  type="button"
                  className="font-semibold text-blue-600 hover:underline cursor-pointer"
                  onClick={() => handleTabChange('login')}
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
