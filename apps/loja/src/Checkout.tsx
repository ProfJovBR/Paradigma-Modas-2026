import { useRef, useState } from 'react';
import { Button } from '@paradigma/ui';
import { money, orderError } from '@paradigma/core';
import { useCustomer } from './CustomerAccount';
import { supabase, customerAuth } from './supabase';

type Item = { variantId: string; quantity: number };
type Props = { items: Item[]; total: number; ready: boolean; onSuccess: () => void; refresh: () => void };
const pendingKey = 'paradigma-checkout-attempt';
type Attempt = { userId?: string | null; key: string; payload: Record<string,unknown> };
function previousAttempt(): Attempt | null { try { return JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null'); } catch { return null; } }
export function Checkout({ items, total, ready, onSuccess, refresh }: Props) {
  const { session, loading: sessionLoading, openAccount } = useCustomer();
  const [attempt, setAttempt] = useState<Attempt|null>(previousAttempt);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(''); const [receipt, setReceipt] = useState<{number:number;subtotal_cents:number}|null>(null);
  const [method, setMethod] = useState('pickup');
  async function send(value: Attempt) {
    if (lock.current || !supabase) return;
    if (sessionLoading) return;
    if ((value.userId ?? null) !== (session?.user.id ?? null)) { setError('Entre na mesma conta usada ao iniciar este pedido para recuperar o envio.'); return; }
    const client = value.userId ? customerAuth : supabase;
    if (!client) return;
    lock.current=true; setBusy(true); setError('');
    try {
      const { data, error: failure } = await client.rpc('submit_order', { p_request_key:value.key,...value.payload });
      if (failure) {
        // Known server rejection rolls back the transaction; transport errors are uncertain.
        if (failure.code === 'P0001' || failure.code === '22023' || failure.code === '22P02') { sessionStorage.removeItem(pendingKey);setAttempt(null); }
        throw failure;
      }
      if (!data || !Number.isSafeInteger(data.number) || !Number.isSafeInteger(data.subtotal_cents)) throw new Error('Invalid receipt');
      setReceipt(data); sessionStorage.removeItem(pendingKey); setAttempt(null); onSuccess();
    } catch (failure) { setError(orderError(failure)); }
    finally { lock.current=false;setBusy(false); }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!ready || busy || attempt || sessionLoading) return;
    const form = new FormData(event.currentTarget); const val=(key:string)=>String(form.get(key) ?? '').trim();
    const value = { userId:session?.user.id ?? null,key:crypto.randomUUID(),payload:{ p_customer:{name:val('name'),email:val('email'),phone:val('phone')},p_delivery:{method,address:method==='delivery'?{cep:val('cep').replace(/\D/g,''),street:val('street'),number:val('number'),complement:val('complement'),district:val('district'),city:val('city'),state:val('state')}:null},p_items:items.map(i=>({variant_id:i.variantId,quantity:i.quantity})),p_expected_subtotal:total,p_notes:val('notes') } };
    // Persist the exact request before network I/O so reload/retry cannot duplicate it.
    try { sessionStorage.setItem(pendingKey,JSON.stringify(value)); } catch { setError('Permita o armazenamento desta sessão para enviar o pedido com segurança.');return; }
    setAttempt(value); void send(value);
  }
  if (receipt) return <section className="panel checkout-receipt" role="status"><h2>Pedido enviado!</h2><p>Seu protocolo é <strong>#{receipt.number}</strong>.</p><p>Subtotal dos produtos: <strong>{money(receipt.subtotal_cents)}</strong>.</p><p>A loja recebeu sua solicitação e entrará em contato pelo telefone informado para confirmar disponibilidade, entrega e pagamento. Nenhum valor foi cobrado.</p><a className="button" href="#catalogo">Continuar explorando</a></section>;
  return <form id="checkout-form" onSubmit={submit} className="checkout-fields">
    {attempt && <section className="panel" role="status"><h2>{busy?'Enviando pedido…':'Confira o envio pendente'}</h2><p>Existe uma tentativa de envio nesta sessão. Recuperar o resultado usa os mesmos dados e evita duplicação, mesmo se você recarregou a página.</p><Button disabled={busy} onClick={()=>void send(attempt)}>Verificar envio / tentar novamente</Button></section>}
    {error && <div className="panel" role="alert"><p>{error}</p>{!attempt && <Button className="secondary" onClick={refresh}>Atualizar valores e estoque</Button>}</div>}
    <fieldset disabled={busy || !!attempt} className="checkout-fieldset">
      <section className="panel"><h2>1. Seus dados</h2>{!session && <p>Para acompanhar o pedido na sua conta, <button type="button" className="text-link" onClick={openAccount}>entre antes de enviar</button>.</p>}<div className="field-grid">
        <label>Nome completo<input name="name" defaultValue={session?.user.user_metadata?.full_name ?? ''} autoComplete="name" required minLength={2} maxLength={160}/></label>
        <label>E-mail<input name="email" defaultValue={session?.user.email ?? ''} type="email" autoComplete="email" required maxLength={254}/></label>
        <label>Telefone / WhatsApp<input name="phone" type="tel" autoComplete="tel" required pattern="[+0-9 ()-]{10,22}" maxLength={22} placeholder="(16) 99999-9999"/></label>
      </div></section>
      <section className="panel"><h2>2. Como receber</h2><label>Modalidade<select value={method} onChange={e=>setMethod(e.target.value)}><option value="pickup">Retirada combinada com a loja</option><option value="delivery">Entrega a combinar</option></select></label>
      <p className="muted">{method==='pickup'?'A loja combinará o local e o horário da retirada.':'O frete e o prazo serão informados pela loja antes da confirmação. O subtotal não inclui frete.'}</p>
      {method==='delivery' && <div className="field-grid">
        <label>CEP<input name="cep" autoComplete="postal-code" required pattern="[0-9]{5}-?[0-9]{3}" maxLength={9}/></label>
        <label>Endereço<input name="street" autoComplete="address-line1" required minLength={2} maxLength={160}/></label>
        <label>Número<input name="number" required maxLength={20}/></label>
        <label>Complemento<input name="complement" autoComplete="address-line2" maxLength={160}/></label>
        <label>Bairro<input name="district" required minLength={2} maxLength={100}/></label>
        <label>Cidade<input name="city" autoComplete="address-level2" required minLength={2} maxLength={100}/></label>
        <label>Estado<select name="state" autoComplete="address-level1" required defaultValue=""><option value="">Selecione</option>{'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(uf=><option key={uf}>{uf}</option>)}</select></label>
      </div>}</section>
      <section className="panel"><h2>3. Revise e confirme</h2><p>Pagamento combinado diretamente com a loja. Este envio não realiza cobrança e não reserva estoque. A confirmação depende da disponibilidade.</p><label>Observações (opcional)<textarea name="notes" maxLength={1000} rows={3}/></label><label className="checkout-consent"><input type="checkbox" required/>Entendo que frete e pagamento serão combinados com a loja e que meus dados serão usados para atender este pedido.</label><p><strong>Subtotal dos produtos: {ready?money(total):'aguardando conferência do carrinho'}</strong></p><Button type="submit" disabled={!ready || busy}>CONFIRMAR PEDIDO</Button>{!ready && <p role="status">Adicione itens disponíveis e confira o carrinho antes de enviar.</p>}</section>
    </fieldset>
  </form>;
}
