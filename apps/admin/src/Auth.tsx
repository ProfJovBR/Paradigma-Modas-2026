import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';
import { Brand, Button } from '@paradigma/ui';
import type { Session } from '@paradigma/core';
import { supabase, configurationError } from './supabase';

const AuthContext = createContext<{ session: Session; logout: () => Promise<void> } | null>(null);
export function useAdmin() { return useContext(AuthContext)!; }
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [role, setRole] = useState<'checking' | 'admin' | 'denied' | 'error'>('checking');
  const [retry, setRetry] = useState(0);
  const sessionUser = useRef<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    let active = true; let version = 0;
    const receiveSession = (next: Session | null) => {
      if (sessionUser.current !== (next?.user.id ?? null)) setRole('checking');
      sessionUser.current = next?.user.id ?? null;
      setSession(next); setInitialized(true);
    };
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      version++; if (active) receiveSession(next);
    });
    const initialVersion = version;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || version !== initialVersion) return;
      receiveSession(data.session);
      if (error) setError('Não foi possível recuperar a sessão. Entre novamente.');
    }).catch(() => { if (active) { setInitialized(true); setError('Não foi possível recuperar a sessão.'); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!session || !supabase) return;
    // Keep the current user's screen mounted while revalidating. RLS guards every operation.
    let active = true;
    void supabase.rpc('is_admin').then(({ data, error }) => {
      if (active) setRole(error ? 'error' : data === true ? 'admin' : 'denied');
    }, () => { if (active) setRole('error'); });
    return () => { active = false; };
  }, [session, retry]);
  // Revalidate membership when returning to the tab; RLS always enforces revocation immediately.
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') setRetry(n => n + 1); };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  async function logout() {
    const { error } = await supabase!.auth.signOut({ scope: 'local' });
    if (error) { setError('Não foi possível encerrar a sessão. Tente novamente.'); return; }
    setSession(null); setRole('checking'); setError('');
  }
  if (supabase && initialized && session && role === 'admin') return <AuthContext.Provider value={{ session, logout }}>{error && <div role="alert" className="feedback error">{error}</div>}{children}</AuthContext.Provider>;
  return <div className="auth-page"><div className="auth-brand"><Brand /><span className="eyebrow">PAINEL ADMINISTRATIVO</span></div><main className="auth-form"><h1>{!supabase ? 'Configurar acesso' : session ? 'Acesso administrativo' : 'Entrar no painel'}</h1>{!supabase ? <p role="status">{configurationError}</p> : !initialized || (session && role === 'checking') ? <p role="status">Verificando sessão e permissões…</p> : session ? <><p role="alert">{role === 'denied' ? 'Sua conta não tem permissão administrativa. Solicite acesso à responsável pelo projeto.' : 'Não foi possível verificar suas permissões. Confira a conexão e as migrations.'}</p><div className="action-row"><Button className="secondary" onClick={() => setRetry(retry + 1)}><RefreshCw size={16} />Tentar novamente</Button><Button onClick={() => void logout()}><LogOut size={16} />Sair</Button></div></> : <Login />}{error && <p role="alert" className="feedback error">{error}</p>}</main></div>;
}
function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <form onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password }); if (error) setError('Não foi possível entrar. Confira suas credenciais e a conexão.'); }
    catch { setError('Não foi possível entrar. Tente novamente.'); }
    finally { setBusy(false); setPassword(''); }
  }}><label>E-mail<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p role="alert" className="feedback error">{error}</p>}<Button disabled={busy}><LogIn size={17} />{busy ? 'Entrando…' : 'Entrar'}</Button></form>;
}
