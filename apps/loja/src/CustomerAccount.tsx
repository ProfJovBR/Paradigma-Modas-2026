import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@paradigma/core';
import { UserRound, X } from 'lucide-react';
import { CustomerOrders, RecentlyViewed } from './AccountHistory';
import { customerAuth } from './supabase';

type CustomerContext = { session: Session | null; loading: boolean; openAccount: () => void };
const Context = createContext<CustomerContext | null>(null);
export function useCustomer() { return useContext(Context)!; }

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!customerAuth);
  const [open, setOpen] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const authReturn = useRef(window.location.hash.includes('access_token='));
  useEffect(() => {
    if (!customerAuth) return;
    if (window.location.hash.includes('error_description=')) {
      setSessionError('Este link de confirmação expirou ou é inválido. Tente entrar ou solicite ajuda à loja.');
      window.history.replaceState(null, '', window.location.pathname + window.location.search + '#conta');
      setOpen(true);
    }
    let active = true;
    const { data: { subscription } } = customerAuth.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next); setLoading(false);

      if (next && authReturn.current) { authReturn.current = false; window.location.hash = 'conta'; }
    });
    void customerAuth.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setSessionError('Não foi possível recuperar sua sessão. Tente entrar novamente.');
      setSession(data.session); setLoading(false);
    }).catch(() => { if (active) { setLoading(false); setSessionError('Não foi possível recuperar sua sessão. Tente entrar novamente.'); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (open && session) { setOpen(false); window.location.hash = 'conta'; } }, [open, session]);
  function openAccount() {
    if (session) window.location.hash = 'conta';
    else setOpen(true);
  }
  return <Context.Provider value={{ session, loading, openAccount }}>{children}{open && <AuthModal initialError={sessionError} onClose={() => setOpen(false)} onSuccess={() => { setOpen(false); window.location.hash = 'conta'; }} />}</Context.Provider>;
}

function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'invalid_credentials') return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
  if (code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.';
  if (code === 'user_already_exists') return 'Não foi possível criar a conta. Se já tiver cadastro, use Entrar.';
  if (code === 'weak_password') return 'Escolha uma senha mais forte, com letras, números e símbolos.';
  if (code === 'signup_disabled') return 'O cadastro está temporariamente indisponível. Tente novamente mais tarde.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  return 'Não foi possível concluir. Confira sua conexão e tente novamente.';
}

function AuthModal({ onClose, onSuccess, initialError }: { onClose: () => void; onSuccess: () => void; initialError: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError); const [notice, setNotice] = useState('');
  useEffect(() => {
    mounted.current = true;
    const element = dialog.current!; const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { mounted.current = false; element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  function switchMode(next: 'login' | 'signup') { setMode(next); setPassword(''); setConfirm(''); setError(''); setNotice(''); }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!customerAuth || lock.current) return;
    setError(''); setNotice('');
    if (mode === 'signup' && !name.trim()) { setError('Informe seu nome.'); return; }
    if (mode === 'signup' && password !== confirm) { setError('As senhas não coincidem.'); return; }
    lock.current = true; setBusy(true);
    try {
      const result = mode === 'login'
        ? await customerAuth.auth.signInWithPassword({ email: email.trim(), password })
        : await customerAuth.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + '/' } });
      if (result.error) throw result.error;
      if (!mounted.current) return;
      setPassword(''); setConfirm('');
      if (result.data.session) onSuccess();
      else setNotice('Confira seu e-mail para confirmar o cadastro e depois entre com sua senha. Se já tiver uma conta, use Entrar.');
    } catch (failure) { if (mounted.current) setError(authError(failure)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <dialog ref={dialog} className="customer-dialog" aria-labelledby="customer-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="customer-modal-body">
      <button type="button" className="icon-button customer-close" aria-label="Fechar acesso à conta" onClick={onClose}><X /></button>
      <span className="customer-mark"><UserRound size={28} /></span><p className="eyebrow">SEU ESPAÇO NA PARADIGMA</p>
      <h2 id="customer-title">{mode === 'login' ? 'Bom ter você por aqui.' : 'Seu próximo capítulo.'}</h2>
      <p className="muted">{mode === 'login' ? 'Entre na sua conta ou crie uma para começar.' : 'Crie sua conta e faça parte da nossa história.'}</p>
      <div className="customer-tabs" aria-label="Opções de acesso"><button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => switchMode('login')}>Entrar</button><button type="button" aria-pressed={mode === 'signup'} disabled={busy} onClick={() => switchMode('signup')}>Criar conta</button></div>
      {!customerAuth ? <p role="alert">O acesso está temporariamente indisponível. Tente novamente mais tarde.</p> : <form className="customer-form" onSubmit={submit}>
        <fieldset disabled={busy || !!notice}>
          {mode === 'signup' && <label>Nome<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} required maxLength={100} /></label>}
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label>
          <label>Senha<input type={visible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === 'signup' ? 8 : undefined} maxLength={128} /></label>
          {mode === 'signup' && <><small className="muted">Use pelo menos 8 caracteres, combinando letras, números e símbolos.</small><label>Confirmar senha<input type={visible ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} maxLength={128} /></label></>}
          <label className="customer-show-password"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />Mostrar senha</label>
          <button className="button" type="submit">{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar na minha conta' : 'Criar minha conta'}</button>
        </fieldset>
        {error && <p className="customer-error" role="alert">{error}</p>}
        {notice && <div className="feedback" role="status"><p>{notice}</p><button type="button" className="text-link" onClick={() => switchMode('login')}>Voltar para entrar</button></div>}
      </form>}
    </div>
  </dialog>;
}

export function AccountPage() {
  const { session, loading, openAccount } = useCustomer();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const checkedInitialSession = useRef(false);
  useEffect(() => {
    if (loading || checkedInitialSession.current) return;
    checkedInitialSession.current = true;
    if (!session) openAccount();
  }, [loading, session, openAccount]);
  async function logout() {
    if (!customerAuth || busy) return;
    setBusy(true); setError('');
    try { const { error: failure } = await customerAuth.auth.signOut({ scope: 'local' }); if (failure) throw failure; window.location.hash = ''; }
    catch { setError('Não foi possível sair. Tente novamente.'); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="shop-container" role="status">Carregando sua conta…</div>;
  if (!session) return <section className="shop-container customer-account"><h1>Minha conta</h1><p>Entre para acessar seus dados.</p><button className="button" onClick={openAccount}>Entrar ou criar conta</button></section>;
  const name = session.user.user_metadata?.full_name;
  return <section className="shop-container customer-account"><div className="breadcrumb"><a href="#">Início</a><span>›</span>Minha conta</div><p className="eyebrow">SEU ESPAÇO</p><h1>Olá{typeof name === 'string' && name.trim() ? `, ${name}` : ''}!</h1><p className="muted">Que bom ter você na Paradigma.</p><div className="customer-account-grid"><section className="panel customer-details account-section"><span className="eyebrow">01 · SEU PERFIL</span><h2>Dados da conta</h2><dl>{typeof name === 'string' && name.trim() && <><dt>Nome</dt><dd>{name}</dd></>}<dt>E-mail</dt><dd>{session.user.email}</dd></dl><div className="customer-account-actions"><a className="button" href="#catalogo">Explorar coleção</a><a className="button secondary" href="#favoritos">Meus favoritos</a><button className="text-link" disabled={busy} onClick={() => void logout()}>{busy ? 'Saindo…' : 'Sair da conta'}</button></div>{error && <p role="alert">{error}</p>}</section><CustomerOrders key={`orders-${session.user.id}`} userId={session.user.id} /><RecentlyViewed key={`views-${session.user.id}`} userId={session.user.id} /></div></section>;
}
