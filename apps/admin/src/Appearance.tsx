import { useEffect, useRef, useState } from 'react';
import { Eye, Monitor, RotateCcw, Save, Smartphone } from 'lucide-react';
import { Button, StorePreview } from '@paradigma/ui';
import { defaultTheme, isTheme, themeLabels, themeStyle, themeValidation, type Theme } from '@paradigma/ui/theme';
import { supabase } from './supabase';

type EditorState = { draft: Theme | null; published: Theme | null; revision: string };
function editorState(data: unknown): EditorState {
  const state = data as EditorState | null;
  if (!state || typeof state.revision !== 'string' || (state.draft !== null && !isTheme(state.draft)) || (state.published !== null && !isTheme(state.published))) throw new Error('invalid response');
  return state;
}
function messageFor(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === '40001') return 'O tema foi alterado em outra aba. Recarregue o tema salvo antes de tentar novamente.';
  if (code === '42501') return 'Sua conta não tem mais permissão para salvar o tema. Entre novamente no painel.';
  if (code === 'PGRST202' || code === '42P01') return 'A personalização ainda precisa ser ativada no banco. Aplique a migration de tema fornecida com o projeto e tente novamente.';
  if (code === '22023') return 'O servidor recusou as cores. Confira o formato e o contraste antes de publicar.';
  return 'Não foi possível confirmar a operação. Recarregue o tema salvo para conferir o estado no servidor.';
}
export function Appearance() {
  const [theme, setTheme] = useState<Theme>({ ...defaultTheme });
  const [saved, setSaved] = useState<EditorState | null>(null);
  const [device, setDevice] = useState('desktop');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setNotice('');
    void (async () => {
      try {
        if (!supabase) throw new Error('not configured');
        const { data, error: failure } = await supabase.rpc('get_theme_editor');
        if (failure) throw failure;
        const state = editorState(data);
        if (active) { setSaved(state); setTheme(state.draft ?? state.published ?? { ...defaultTheme }); }
      } catch (failure) { if (active) { setSaved(null); setError(messageFor(failure)); } }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [reload]);
  const dirty = !!saved && JSON.stringify(theme) !== JSON.stringify(saved.draft ?? saved.published ?? defaultTheme);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const validation = themeValidation(theme);
  async function save(publish: boolean) {
    if (!saved || !supabase || locked.current || (publish && validation)) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const { data, error: failure } = await supabase.rpc('save_theme', { p_tokens: theme, p_revision: saved.revision, p_publish: publish });
      if (failure) throw failure;
      const state = editorState(data);
      setSaved(state); setTheme(state.draft ?? { ...defaultTheme });
      setNotice(publish ? 'Tema publicado. A loja recebe as cores ao recarregar, retomar o foco ou em até 60 segundos enquanto visível.' : 'Rascunho salvo. As cores da loja não foram alteradas.');
    } catch (failure) { setError(messageFor(failure)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <>
    {busy && <p role="status">Carregando ou salvando tema…</p>}
    {error && <div role="alert" className="feedback error">{error}</div>}
    {notice && <p role="status" className="feedback">{notice}</p>}
    <div className="appearance-grid">
      <section className="color-settings"><h2>Cores da marca</h2>
        <fieldset disabled={busy || !saved}>
          {(Object.keys(defaultTheme) as (keyof Theme)[]).map(key => <label className="color-row" key={key}><input type="color" aria-label={themeLabels[key]} value={theme[key]} onChange={e => { setTheme({ ...theme, [key]: e.target.value }); setNotice(''); }} /><span>{themeLabels[key]}<small>{theme[key].toUpperCase()}</small></span></label>)}
          <Button className="secondary" onClick={() => { setTheme({ ...defaultTheme }); setNotice(''); }}><RotateCcw size={16} />Restaurar padrão</Button>
        </fieldset>
        <Button className="secondary theme-reload" disabled={busy} onClick={() => {
          if (!dirty || window.confirm('Descartar as alterações locais e carregar o tema salvo?')) setReload(value => value + 1);
        }}>Recarregar tema salvo</Button>
      </section>
      <section className="preview-section"><div className="subheading"><h2><Eye size={18} />Prévia da loja</h2><div className="segmented"><button aria-label="Prévia desktop" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={18} /></button><button aria-label="Prévia celular" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={18} /></button></div></div><div className={`preview-frame ${device}`} style={themeStyle(theme)}><StorePreview /></div></section>
    </div>
    {saved && validation && <p className="feedback error" role="alert">{validation} Você pode salvar como rascunho.</p>}
    <div className="form-actions"><span>{dirty ? 'Alterações ainda não salvas. ' : ''}A prévia só altera a loja ao publicar.</span><div className="action-row"><Button className="secondary" disabled={busy || !saved || !isTheme(theme)} onClick={() => void save(false)}><Save size={16} />Salvar rascunho</Button><Button disabled={busy || !saved || !!validation} onClick={() => void save(true)}>Publicar tema</Button></div></div>
  </>;
}
