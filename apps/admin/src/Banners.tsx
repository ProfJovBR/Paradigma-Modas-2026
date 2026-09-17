import { useCallback, useEffect, useRef, useState } from 'react';
import { bannerDefinitions, validateBannerImage, type Banner, type BannerSlot } from '@paradigma/core';
import { BannerImage, Button } from '@paradigma/ui';
import { bannerErrorMessage, BannerSaveError, cleanupBannerFiles, loadBanner, publishBanner } from './banner-api';
import { supabase } from './supabase';

export function Banners() {
  const [cleanupWarning, setCleanupWarning] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const cleanupQueue = useRef(Promise.resolve());
  const cleanup = useCallback(() => {
    // Serialize cleanup requests without dropping one when both cards publish together.
    cleanupQueue.current = cleanupQueue.current.then(async () => {
      setCleaning(true);
      try { await cleanupBannerFiles(); setCleanupWarning(''); }
      catch { setCleanupWarning('A limpeza de arquivos antigos não foi concluída. Os banners publicados estão preservados. Tente novamente quando a conexão e a permissão estiverem disponíveis.'); }
      finally { setCleaning(false); }
    });
    return cleanupQueue.current;
  }, []);
  useEffect(() => { void cleanup(); }, [cleanup]);
  return <>
    <p className="muted">Gerencie as imagens da página inicial. A seleção fica apenas na prévia até salvar e publicar. Cada banner usa uma imagem responsiva em todos os dispositivos.</p>
    {cleanupWarning && <div className="feedback error" role="alert"><p>{cleanupWarning}</p><Button className="secondary" disabled={cleaning} onClick={() => void cleanup()}>Tentar limpeza novamente</Button></div>}
    <div className="banner-editors">{(['hero', 'cta'] as const).map(slot => <BannerEditor key={slot} slot={slot} cleanup={cleanup} />)}</div>
  </>;
}

function BannerEditor({ slot, cleanup }: { slot: BannerSlot; cleanup: () => Promise<void> }) {
  const definition = bannerDefinitions[slot];
  const [saved, setSaved] = useState<Banner | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [remove, setRemove] = useState(false);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(true);
  const [phase, setPhase] = useState('Carregando banner…');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setBusy(true); setPhase('Carregando banner…'); setError(''); setNotice('');
    void loadBanner(slot).then(data => {
      if (active) { setSaved(data); setAlt(data.alt); setFile(null); setRemove(false); setReloadRequired(false); if (input.current) input.current.value = ''; }
    }).catch(failure => { if (active) { setError(bannerErrorMessage(failure)); setReloadRequired(true); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [slot, reload]);
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file); setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const dirty = !!saved && (!!file || remove || alt !== saved.alt);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function cancel() {
    setFile(null); setRemove(false); setAlt(saved?.alt ?? ''); setNotice('');
    if (!reloadRequired) setError('');
    if (input.current) input.current.value = '';
  }
  async function selectFile(next: File | undefined) {
    if (!next || locked.current) return;
    locked.current = true; setBusy(true); setPhase('Validando imagem…'); setError(''); setNotice('');
    try {
      await validateBannerImage(next);
      if (mounted.current) { setFile(next); setRemove(false); }
    } catch (failure) {
      if (mounted.current) { setError(failure instanceof Error ? failure.message : 'Imagem inválida.'); if (input.current) input.current.value = ''; }
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function save() {
    if (!saved || !dirty || locked.current || reloadRequired) return;
    locked.current = true; setBusy(true); setPhase('Enviando e publicando banner…'); setError(''); setNotice('');
    try {
      const published = await publishBanner(saved, file, remove, alt);
      if (mounted.current) {
        setSaved(published); setAlt(published.alt); setFile(null); setRemove(false);
        if (input.current) input.current.value = '';
        setNotice('Banner publicado. A loja atualiza ao abrir, retomar o foco ou em até 60 segundos enquanto visível.');
      }
    } catch (failure) {
      if (mounted.current) { setError(bannerErrorMessage(failure)); setReloadRequired(failure instanceof BannerSaveError && failure.reloadRequired); }
    } finally {
      await cleanup(); locked.current = false; if (mounted.current) setBusy(false);
    }
  }
  const previewBanner = saved ? { ...saved, path: remove ? null : saved.path, alt } : null;
  return <section className="panel banner-editor" aria-labelledby={`banner-${slot}`}>
    <h2 id={`banner-${slot}`}>{definition.name}</h2>
    <p id={`banner-help-${slot}`} className="muted">{slot === 'hero' ? 'Banner principal no topo da página inicial.' : 'Banner abaixo da seção de produtos.'} Recomendado: {definition.dimensions}. JPG, PNG ou WebP, até 5 MB. A imagem preenche a área com recorte, sem distorção; mantenha o assunto principal no centro.</p>
    {busy && !notice && <p role="status">{phase}</p>}
    {error && <p role="alert" className="feedback error">{error}</p>}
    {notice && <p role="status" className="feedback">{notice}</p>}
    {saved && <><h3>Imagem publicada</h3><div className={`banner-editor-photo ${slot}`} data-testid={`${slot}-published`}>
      <BannerImage client={supabase} slot={slot} banner={saved} onFailure={setImageFailed} />
    </div><p className="muted">{!saved.path ? 'Sem imagem cadastrada: a loja usa a imagem padrão.' : imageFailed ? 'Não foi possível carregar a imagem publicada. Exibindo a imagem padrão.' : 'Imagem atual publicada na loja.'}</p></>}
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || !saved || reloadRequired}>
        <label>Nova imagem<input ref={input} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-describedby={`banner-help-${slot}`} onChange={event => void selectFile(event.target.files?.[0])} /></label>
        <label>Texto alternativo<input value={alt} maxLength={300} placeholder="Descreva a imagem para quem não pode vê-la" onChange={event => { setAlt(event.target.value); setNotice(''); }} /></label>
        <p className="muted">Até 300 caracteres. Pode ficar vazio se a imagem for apenas decorativa.</p>
        {dirty && <><h3>Prévia não publicada</h3><div className={`banner-editor-photo ${slot}`} data-testid={`${slot}-preview`}>
          <BannerImage client={supabase} slot={slot} banner={previewBanner} previewUrl={file ? previewUrl : undefined} previewAlt={alt} />
        </div>{remove && <p className="muted">Ao publicar, a imagem personalizada será removida e a loja voltará ao padrão.</p>}</>}
        <div className="action-row banner-actions">
          <Button type="button" className="secondary" disabled={(!saved?.path && !file) || remove} onClick={() => { setRemove(!!saved?.path); setFile(null); setAlt(''); setNotice(''); if (input.current) input.current.value = ''; }}>Remover imagem</Button>
          <Button type="submit" disabled={!dirty}>Salvar e publicar</Button>
        </div>
      </fieldset>
    </form>
    <div className="action-row banner-actions">
      <Button className="secondary" disabled={busy || !dirty} onClick={cancel}>Cancelar alterações</Button>
      <Button className="secondary" disabled={busy} onClick={() => {
        if (dirty && !window.confirm('Descartar alterações locais e recarregar o banner publicado?')) return;
        setReload(n => n + 1);
      }}>Recarregar banner publicado</Button>
    </div>
    {dirty && <p className="muted">Alterações não salvas serão perdidas ao sair desta página.</p>}
  </section>;
}
