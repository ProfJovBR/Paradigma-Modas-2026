import { useEffect, useState } from 'react';
import { contactError, isContactSettings, type ContactSettings as ContactData } from '@paradigma/core';
import { db } from './catalog-api';

type Editor = ContactData & { revision: string };
export function ContactSettings() {
  const [value, setValue] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() {
    setLoading(true); setError(''); setMessage('');
    try {
      const { data, error } = await db().rpc('get_contact_editor');
      if (error) throw error;
      if (!isContactSettings(data) || !('revision' in data) || typeof data.revision !== 'string') throw new Error('Invalid contact response');
      setValue(data as Editor);
    } catch { setError('Não foi possível carregar os contatos. Confira a conexão e se a atualização do banco de contatos foi aplicada.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!value || saving) return;
    const clean = { ...value, email: value.email.trim(), whatsapp: value.whatsapp.trim(), phone: value.phone.trim() };
    const invalid = contactError(clean); setMessage(''); setError(invalid ?? ''); if (invalid) return;
    setSaving(true);
    try {
      const { revision, ...settings } = clean;
      const { data, error } = await db().rpc('save_contact_settings', { p_settings: settings, p_revision: revision });
      if (error) throw error;
      if (!isContactSettings(data) || !('revision' in data) || typeof data.revision !== 'string') throw new Error('Invalid contact response');
      setValue(data as Editor); setMessage('Contatos salvos. A loja exibirá somente os canais habilitados.');
    } catch (err) {
      setError((err as { code?: string }).code === '40001'
        ? 'Os contatos foram alterados em outra aba. Recarregue antes de editar novamente.'
        : 'Não foi possível confirmar a gravação. Recarregue para conferir os dados no servidor antes de tentar novamente.');
    } finally { setSaving(false); }
  }
  return <section className="panel contact-settings"><h2>Fale conosco</h2><p className="muted">Cadastre os canais da loja e escolha quais aparecem para os clientes. Salvar atualiza os contatos públicos.</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {loading ? <p role="status">Carregando contatos…</p> : value && <form onSubmit={e => void save(e)}><fieldset disabled={saving} className="contact-fields">
      {([{ key: 'email', label: 'E-mail de atendimento', type: 'email', hint: 'As mensagens serão endereçadas a este e-mail no aplicativo de e-mail do cliente.' }, { key: 'whatsapp', label: 'WhatsApp', type: 'tel', hint: 'Use o código do país e DDD. Exemplo: +5516999999999.' }, { key: 'phone', label: 'Telefone', type: 'tel', hint: 'Use o código do país e DDD. Exemplo: +551633333333.' }] as const).map(channel => <div className="contact-setting" key={channel.key}>
        <label htmlFor={`contact-${channel.key}`}>{channel.label}</label><input id={`contact-${channel.key}`} type={channel.type} maxLength={channel.key === 'email' ? 254 : 16} value={value[channel.key]} onChange={e => { setValue({ ...value, [channel.key]: e.target.value }); setMessage(''); }} aria-describedby={`hint-${channel.key}`} />
        <small id={`hint-${channel.key}`} className="muted">{channel.hint}</small>
        <label className="contact-toggle"><input type="checkbox" checked={value[`${channel.key}_visible`]} onChange={e => { setValue({ ...value, [`${channel.key}_visible`]: e.target.checked }); setMessage(''); }} />Exibir {channel.label.toLowerCase()} na loja</label>
      </div>)}<p className="muted">Canais ocultos não têm seus dados disponibilizados pela consulta pública. Não há envio automático de e-mails pelo site.</p><button className="button" type="submit">{saving ? 'Salvando…' : 'Salvar contatos'}</button>
    </fieldset></form>}
    <button className="button secondary" type="button" disabled={loading || saving} onClick={() => void load()}>Recarregar dados salvos</button>
  </section>;
}
