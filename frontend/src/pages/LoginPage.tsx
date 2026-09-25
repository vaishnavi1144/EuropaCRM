import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';
import { firstAllowedPath } from '@/lib/permissions';

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (options: Record<string, unknown>) => void; renderButton: (element: HTMLElement, options: Record<string, unknown>) => void } } };
  }
}

export function LoginPage() {
  const { isAuthenticated, authLoading, login, googleLogin } = useApp();
  const navigate = useNavigate();
  const googleButton = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = 'Welcome Back | Europa CRM'; }, []);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId || !googleButton.current) return;
    const setup = () => {
      if (!window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) return;
          setSubmitting(true);
          try {
            const user = await googleLogin(response.credential, rememberMe);
            navigate(firstAllowedPath(user.role, user.permissions), { replace: true });
            toast.success('Welcome to Europa CRM');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Google login failed');
          } finally { setSubmitting(false); }
        },
      });
      googleButton.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButton.current, { theme: 'outline', size: 'medium', width: 340, text: 'signin_with', shape: 'rectangular' });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-europa-google]');
    if (existing) { if (window.google) setup(); else existing.addEventListener('load', setup, { once: true }); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true; script.defer = true; script.dataset.europaGoogle = 'true'; script.onload = setup;
    document.head.appendChild(script);
  }, [googleLogin, navigate, rememberMe]);

  if (!authLoading && isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const user = await login(username.trim(), password, rememberMe);
      navigate(firstAllowedPath(user.role, user.permissions), { replace: true });
      toast.success('Welcome to Europa CRM');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to login');
    } finally { setSubmitting(false); }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#edfbf8] overflow-hidden px-4 py-8">
      {/* Organic background mint/teal blobs matching reference image 1 */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#d2f4ef]/60 filter blur-[90px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#d2f4ef]/60 filter blur-[90px] pointer-events-none" />
      <div className="absolute top-[40%] left-[10%] w-[300px] h-[300px] rounded-full bg-[#e6faf7]/80 filter blur-[70px] pointer-events-none" />
      <div className="absolute bottom-[30%] right-[10%] w-[350px] h-[350px] rounded-full bg-[#e6faf7]/80 filter blur-[80px] pointer-events-none" />

      {/* Centered White Rounded Login Card */}
      <div className="relative z-10 w-full max-w-[480px] rounded-[28px] bg-white p-8 sm:p-10 md:p-12 shadow-[0_15px_45px_rgba(7,27,74,0.06)] border border-[#E4ECF3]">
        {/* Europa CRM logo */}
        <div className="flex justify-center mb-8">
          <img src="/europa-logo.png" alt="Europa CRM" className="h-16 w-auto object-contain" />
        </div>

        {/* Header and Subheader */}
        <h1 className="text-center text-[30px] font-black text-[#071B4A] tracking-tight leading-tight">Welcome Back</h1>
        <p className="text-center text-[14px] font-semibold text-slate-400 mt-2 mb-8">Login to Europa CRM</p>

        {/* Login Form */}
        <form onSubmit={submit} autoComplete="off" className="space-y-5">
          <input aria-hidden="true" tabIndex={-1} className="hidden" type="text" name="username" autoComplete="username" />
          <input aria-hidden="true" tabIndex={-1} className="hidden" type="password" name="password" autoComplete="current-password" />
          <div>
            <label className="block text-[13px] font-bold text-[#071B4A] mb-2">Username or Email</label>
            <div className="relative">
              <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#009E92]" strokeWidth={1.8} />
              <input
                required
                name="europa_login_identifier"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username or email"
                className="h-13 w-full rounded-xl border border-[#E4ECF3] bg-white pl-12 pr-4 text-[14px] font-medium text-[#071B4A] outline-none transition focus:border-[#009E92] focus:ring-4 focus:ring-[#009E92]/10 placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[#071B4A] mb-2">Password</label>
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#009E92]" strokeWidth={1.8} />
              <input
                required
                name="europa_login_secret"
                autoComplete="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-13 w-full rounded-xl border border-[#E4ECF3] bg-white pl-12 pr-12 text-[14px] font-medium text-[#071B4A] outline-none transition focus:border-[#009E92] focus:ring-4 focus:ring-[#009E92]/10 placeholder-slate-400"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#009E92] hover:text-[#008277] transition"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Remember me & Forgot Password */}
          <div className="flex items-center justify-between text-xs font-semibold select-none pt-1">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-[#E4ECF3] text-[#009E92] focus:ring-[#009E92]/20 accent-[#009E92] cursor-pointer"
              />
              Remember me
            </label>
            <span className="text-[#009E92] hover:text-[#008277] hover:underline cursor-pointer">Forgot Password?</span>
          </div>

          {/* Teal Login Button */}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-[#009E92] text-[15px] font-bold text-white shadow-md hover:bg-[#008a7f] active:translate-y-px transition disabled:opacity-60 mt-4"
          >
            {submitting ? (
              <span>Signing in…</span>
            ) : (
              <>
                <span>Login</span>
                <ArrowRight className="h-4.5 w-4.5" strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        {/* Google sign-in if configured */}
        {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div className="mt-5 flex flex-col items-center">
            <div className="my-4 flex items-center gap-4 text-xs text-slate-400 w-full">
              <div className="h-px flex-1 bg-[#E4ECF3]" />
              <span>or</span>
              <div className="h-px flex-1 bg-[#E4ECF3]" />
            </div>
            <div ref={googleButton} className="flex min-h-[38px] w-full justify-center" />
          </div>
        )}

        {/* Version Divider and Copyright Footer */}
        <div className="mt-8 pt-6 border-t border-[#E4ECF3] flex items-center justify-center relative">
          <div className="w-full border-t border-[#E4ECF3] absolute" />
          <span className="relative bg-white px-4 text-[11px] font-bold text-slate-400 tracking-wide uppercase">Version 1.0.0</span>
        </div>
        <p className="mt-4 text-center text-[11px] font-bold text-slate-400 tracking-wide">
          © 2026 Europa CRM. All rights reserved.
        </p>
      </div>
    </main>
  );
}
