'use client';

import { FormEvent, useEffect, useState } from 'react';

type Session = { user?: { name?: string; email?: string } } | null;

type Mode = 'signin' | 'signup';

async function authRequest(action: string, payload?: Record<string, string>) {
  const response = await fetch(`/api/auth/${action}`, {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'content-type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    credentials: 'include',
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || 'Authentication failed.');
  return data;
}

export function AuthNav() {
  const [session, setSession] = useState<Session>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const data = await authRequest('get-session');
      setSession(data?.user ? data : null);
    } catch {
      setSession(null);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') {
        await authRequest('sign-up/email', { name: name.trim(), email: email.trim(), password });
      } else {
        await authRequest('sign-in/email', { email: email.trim(), password });
      }
      await refresh();
      setOpen(false);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await authRequest('sign-out', {});
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  };

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-40 truncate text-xs text-white/55 sm:block">
          {session.user.name || session.user.email}
        </span>
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setMode('signin'); setOpen(true); setError(''); }}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
      >
        Sign in
      </button>
      <button
        type="button"
        onClick={() => { setMode('signup'); setOpen(true); setError(''); }}
        className="rounded-full bg-white px-4 py-2 text-xs font-black text-black hover:bg-white/90"
      >
        Create account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101010] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/35">ShortForge</p>
                <h2 className="mt-2 text-2xl font-black">
                  {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-white/40 hover:text-white">✕</button>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-3">
              {mode === 'signup' && (
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  autoComplete="name"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              )}
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/30"
              />
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (8+ characters)"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/30"
              />
              {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black disabled:opacity-50"
              >
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="mt-4 w-full text-xs text-white/45 hover:text-white"
            >
              {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
