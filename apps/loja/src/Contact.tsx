import { useEffect, useState } from 'react';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { loadPublicContact, type ContactSettings } from '@paradigma/core';
import { supabase } from './supabase';

export function Contact() {
  const [settings, setSettings] = useState<ContactSettings | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  useEffect(() => {
    let active = true;
    async function refresh() {
      try { const data = await loadPublicContact(supabase); if (active) { setSettings(data); setError(''); } }
      catch { if (active) { setSettings(null); setError('Não foi possível carregar os canais de atendimento. Tente novamente.'); } }
    }
    void refresh();
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', visible);
    const interval = window.setInterval(visible, 60000);
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', visible); };
  }, [attempt]);
  const channels = settings && (settings.email_visible || settings.whatsapp_visible || settings.phone_visible);
  return <div className="shop-container contact-page"><div className="breadcrumb"><a href="#">Início</a><span>›</span>Fale conosco</div><p className="eyebrow">ATENDIMENTO PARADIGMA</p><h1 className="display-title">Vamos conversar?</h1><p className="muted">Tire suas dúvidas sobre peças, pedidos e atendimento.</p>
    {error ? <div role="alert"><p>{error}</p><button className="button secondary" onClick={() => { setError(''); setAttempt(n => n + 1); }}>Tentar novamente</button></div> : !settings ? <p role="status">Carregando contatos…</p> : !channels ? <p>Os canais de atendimento ainda não estão disponíveis. Volte em breve.</p> : <>
      <div className="contact-cards">
        {settings.email_visible && <section className="panel"><Mail aria-hidden="true" /><h2>E-mail</h2><a href={`mailto:${encodeURIComponent(settings.email).replace(/%40/g, '@')}`}>{settings.email}</a><p className="muted">Escreva para a nossa equipe.</p></section>}
        {settings.whatsapp_visible && <section className="panel"><MessageCircle aria-hidden="true" /><h2>WhatsApp</h2><a className="button secondary" href={`https://wa.me/${settings.whatsapp.slice(1)}`} target="_blank" rel="noreferrer">Conversar no WhatsApp</a><p>{settings.whatsapp}</p></section>}
        {settings.phone_visible && <section className="panel"><Phone aria-hidden="true" /><h2>Telefone</h2><a href={`tel:${settings.phone}`}>{settings.phone}</a><p className="muted">Toque no número para ligar.</p></section>}
      </div>
      {settings.email_visible && <section className="panel contact-message"><h2>Escreva sua mensagem</h2><p className="muted">O botão abre seu aplicativo de e-mail com a mensagem preenchida. Confira e envie por lá.</p><div className="contact-fields"><label htmlFor="contact-subject">Assunto</label><input id="contact-subject" value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} /><label htmlFor="contact-body">Mensagem</label><textarea id="contact-body" rows={6} value={body} maxLength={3000} onChange={e => setBody(e.target.value)} /><a className="button" href={`mailto:${encodeURIComponent(settings.email).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject.trim() || 'Contato pelo site Paradigma')}&body=${encodeURIComponent(body)}`}>Abrir mensagem no e-mail</a><p className="muted">Destinatário: {settings.email}. Nenhuma mensagem é enviada automaticamente.</p></div></section>}
    </>}
  </div>;
}
