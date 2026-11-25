import { useEffect, useState } from 'react';
import { money, orderStatuses, type Order, type Product } from '@paradigma/core';
import { CatalogImage } from '@paradigma/ui';
import { customerAuth, supabase } from './supabase';

const date = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
type CustomerOrder = Pick<Order, 'id' | 'number' | 'status' | 'subtotal_cents' | 'created_at' | 'order_items'>;
export function CustomerOrders({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [limit, setLimit] = useState(20); const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0); const [updated, setUpdated] = useState('');
  useEffect(() => {
    let active = true, pending = false;
    async function load() {
      if (!customerAuth || pending) return;
      pending = true;
      try {
        const { data, error: failure } = await customerAuth.from('orders')
          .select('id,number,status,subtotal_cents,created_at,order_items(id,product_name,sku,size_name,color_name,quantity,unit_price_cents)')
          .eq('customer_id', userId).order('created_at', { ascending: false }).order('id').range(0, limit);
        if (failure) throw failure;
        if (active) { setOrders((data ?? []).slice(0, limit) as CustomerOrder[]); setMore((data?.length ?? 0) > limit); setError(false); setUpdated(new Date().toISOString()); }
      } catch { if (active) setError(true); }
      finally { pending = false; if (active) setLoading(false); }
    }
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [userId, limit, revision]);
  return <section className="panel account-section" aria-labelledby="my-orders-title"><div className="account-section-heading"><span className="eyebrow">02 · ACOMPANHE</span><h2 id="my-orders-title">Meus pedidos</h2><p className="muted">O andamento informado pela loja, atualizado a cada 15 segundos.</p></div>
    <div className="account-scroll" tabIndex={0} role="region" aria-label="Lista de meus pedidos" aria-busy={loading}>
      {loading && <p role="status">Carregando seus pedidos…</p>}
      {error && <p role="alert">Não foi possível sincronizar. {orders.length > 0 && 'Os status exibidos podem estar desatualizados.'} <button className="text-link" onClick={() => setRevision(n => n + 1)}>Tentar novamente</button></p>}
      {!loading && !error && !orders.length && <div className="account-empty"><h3>Seu próximo pedido começa aqui.</h3><p>Os pedidos feitos com sua conta conectada aparecerão nesta lista.</p><a href="#catalogo" className="text-link">Explorar coleção →</a></div>}
      {orders.map(order => <article className="account-order" key={order.id}><h3>Pedido #{order.number}</h3><p className={`account-status status-${order.status}`}>{orderStatuses[order.status] ?? 'Status indisponível'}</p><small className="muted">{date(order.created_at)}</small><ul>{order.order_items.map(item => <li key={item.id}><strong>{item.quantity} × {item.product_name}</strong><small>{item.size_name} · {item.color_name}</small></li>)}</ul><div className="account-order-total"><span>Subtotal dos produtos</span><strong>{money(order.subtotal_cents)}</strong></div></article>)}
      {more && <button className="button secondary" onClick={() => { setLoading(true); setLimit(n => n + 20); }}>Carregar mais pedidos</button>}
    </div>{updated && <small className="muted account-sync">Última atualização: {date(updated)}</small>}
  </section>;
}

type ViewedProduct = { product_id: string; viewed_at: string; products: Pick<Product, 'id' | 'name' | 'price_cents' | 'product_images'> | null };
export function RecentlyViewed({ userId }: { userId: string }) {
  const [items, setItems] = useState<ViewedProduct[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); const [limit, setLimit] = useState(30); const [more, setMore] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!customerAuth) return;
      setLoading(true); setError(false);
      try {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data, error: failure } = await customerAuth.from('product_views')
          .select('product_id,viewed_at,products(id,name,price_cents,product_images(path,alt,position))')
          .eq('user_id', userId).gte('viewed_at', cutoff).order('viewed_at', { ascending: false }).order('product_id').range(0, limit);
        if (failure) throw failure;
        if (active) { setItems((data ?? []).slice(0, limit) as unknown as ViewedProduct[]); setMore((data?.length ?? 0) > limit); }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [userId, limit, revision]);
  return <section className="panel account-section" aria-labelledby="recent-title"><div className="account-section-heading"><span className="eyebrow">03 · REENCONTRE</span><h2 id="recent-title">Vistos nos últimos 30 dias</h2><p className="muted">As peças que você abriu enquanto estava conectado.</p></div><div className="account-scroll" role="region" aria-label="Produtos vistos recentemente" tabIndex={0} aria-busy={loading}>
    {loading && <p role="status">Carregando seu histórico…</p>}{error && <p role="alert">Não foi possível carregar seu histórico. <button className="text-link" onClick={() => setRevision(n => n + 1)}>Tentar novamente</button></p>}
    {!loading && !error && !items.length && <div className="account-empty"><h3>Uma peça chamou sua atenção?</h3><p>Abra um produto da coleção e ele ficará salvo aqui por 30 dias.</p><a className="text-link" href="#catalogo">Descobrir peças →</a></div>}
    {items.map(item => { const p = item.products; const photo = p?.product_images?.slice().sort((a,b) => a.position-b.position)[0]; return p ? <a className="account-viewed" key={item.product_id} href={`#produto/${p.id}`}><div className="account-viewed-image"><CatalogImage client={supabase!} path={photo?.path} alt={photo?.alt || p.name} /></div><div><h3>{p.name}</h3><strong>{money(p.price_cents)}</strong><small className="muted">Visto em {date(item.viewed_at)}</small></div></a> : <div className="account-viewed" key={item.product_id}><p>Produto indisponível<small className="muted">Visto em {date(item.viewed_at)}</small></p></div>; })}
    {more && <button className="button secondary" disabled={loading} onClick={() => setLimit(n => n + 30)}>Carregar mais produtos</button>}
  </div></section>;
}
