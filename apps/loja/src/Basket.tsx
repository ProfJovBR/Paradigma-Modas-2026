import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CreditCard, Heart, LockKeyhole, Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { Button, CatalogImage, EmptyState, Skeleton } from '@paradigma/ui';
import { money, productSelect, type Product } from '@paradigma/core';
import { supabase } from './supabase';
import { Catalog } from './Catalog';

type Item = { productId: string; variantId: string; quantity: number };
type BasketState = { items: Item[]; favorites: string[]; add: (item: Item) => void; change: (variantId: string, quantity: number) => void; favorite: (id: string) => void };
const BasketContext = createContext<BasketState | null>(null);
export const useBasket = () => useContext(BasketContext)!;
function readSaved(): { items: Item[]; favorites: string[] } {
  try {
    const saved = JSON.parse(sessionStorage.getItem('paradigma-basket') ?? '{}');
    return { items: Array.isArray(saved.items) ? saved.items.filter((v: Item) => typeof v.productId === 'string' && typeof v.variantId === 'string' && Number.isInteger(v.quantity) && v.quantity > 0 && v.quantity <= 99) : [], favorites: Array.isArray(saved.favorites) ? saved.favorites.filter((v: unknown) => typeof v === 'string') : [] };
  } catch { return { items: [], favorites: [] }; }
}
export function BasketProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState(readSaved);
  useEffect(() => { try { sessionStorage.setItem('paradigma-basket', JSON.stringify(saved)); } catch { /* The basket still works in memory. */ } }, [saved]);
  const change = (variantId: string, quantity: number) => setSaved(s => ({ ...s, items: s.items.map(i => i.variantId === variantId ? { ...i, quantity: Math.min(99, quantity) } : i).filter(i => i.quantity > 0) }));
  const add = (item: Item) => setSaved(s => ({ ...s, items: s.items.some(i => i.variantId === item.variantId) ? s.items.map(i => i.variantId === item.variantId ? { ...i, quantity: Math.min(99, i.quantity + item.quantity) } : i) : [...s.items, item] }));
  const favorite = (id: string) => setSaved(s => ({ ...s, favorites: s.favorites.includes(id) ? s.favorites.filter(v => v !== id) : [...s.favorites, id] }));
  return <BasketContext.Provider value={{ ...saved, add, change, favorite }}>{children}</BasketContext.Provider>;
}
export function Quantity({ value, max = 99, onChange }: { value: number; max?: number; onChange: (value: number) => void }) {
  return <div className="quantity"><button type="button" disabled={value <= 1} aria-label="Diminuir quantidade" onClick={() => onChange(value - 1)}><Minus size={15} /></button><input aria-label="Quantidade" type="number" min={1} max={max} value={value} onChange={e => onChange(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} /><button type="button" disabled={value >= max} aria-label="Aumentar quantidade" onClick={() => onChange(value + 1)}><Plus size={15} /></button></div>;
}
export function BasketPage({ checkout = false }: { checkout?: boolean }) {
  const { items, change } = useBasket();
  const [products, setProducts] = useState<Product[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [revision, setRevision] = useState(0);
  const key = items.map(i => i.productId).join(',');
  const loadedKey = useRef<string | null>(null);
  useEffect(() => { const refresh = () => setRevision(n => n + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, []);
  useEffect(() => {
    let active = true; setLoading(loadedKey.current !== key); setError(false);
    void (async () => {
      try {
        if (items.length && !supabase) throw new Error('unavailable');
        const result = await Promise.all([...new Set(items.map(i => i.productId))].map(async id => { const { data, error } = await supabase!.from('products').select(productSelect).eq('id', id).eq('status', 'active').maybeSingle(); if (error) throw error; return data as Product | null; }));
        if (active) { loadedKey.current = key; setProducts(result.filter((p): p is Product => !!p)); }
      } catch { if (active) { loadedKey.current = null; setError(true); } }
      finally { if (active) setLoading(false); }
    })(); return () => { active = false; };
  }, [key, revision]);
  const available = items.every(i => { const p = products.find(p => p.id === i.productId); const v = p?.product_variants.find(v => v.id === i.variantId); return !!v && v.stock >= i.quantity; });
  const total = items.reduce((sum, i) => sum + (products.find(p => p.id === i.productId)?.price_cents ?? 0) * i.quantity, 0);
  const summary = <aside className="order-summary panel"><h2>Resumo do pedido</h2>{checkout && <a className="text-link" href="#carrinho">Editar carrinho</a>}{checkout && items.map(item => { const p = products.find(p => p.id === item.productId); return p && <div className="summary-product" key={item.variantId}><div className="admin-thumb"><CatalogImage client={supabase!} path={p.product_images[0]?.path} alt={p.name} /></div><span>{p.name}<small>{item.quantity} × {money(p.price_cents)}</small></span></div>; })}<dl><div><dt>Subtotal</dt><dd>{loading || error || !available ? 'Indisponível' : money(total)}</dd></div><div><dt>Frete</dt><dd>A calcular</dd></div><div><dt>Desconto</dt><dd>Não aplicado</dd></div><div className="order-total"><dt>Total estimado</dt><dd>{loading || error || !available ? '—' : money(total)}</dd></div></dl>{checkout ? <Button disabled><LockKeyhole size={18} />CONFIRMAR PEDIDO</Button> : <a className="button" href="#checkout">FINALIZAR COMPRA <ArrowRight size={17} /></a>}<p className="muted">A compra online ainda não está habilitada. Nenhum pedido ou pagamento será enviado.</p><div className="summary-benefit"><LockKeyhole /><span>Seus dados e suas escolhas<small>O carrinho não reserva estoque.</small></span></div><div className="summary-benefit"><Truck /><span>Entrega<small>Frete disponível após integração.</small></span></div><div className="handwritten">Mais que moda.<br />Boas escolhas.</div></aside>;
  return <><div className="shop-container">{checkout && <ol className="checkout-steps">{['Identificação', 'Entrega', 'Pagamento', 'Revisão'].map((s, i) => <li key={s}><span>{i + 1}</span>{s}</li>)}</ol>}<div className="breadcrumb"><a href="#">Início</a><span>›</span>{checkout ? 'Checkout' : 'Carrinho de compras'}</div><div className="page-heading"><div><h1>{checkout ? 'Finalizar compra' : 'Seu carrinho'}</h1><p>{checkout ? 'Confira seus dados e os detalhes da sua seleção.' : `${items.reduce((s, i) => s + i.quantity, 0)} itens na sua seleção.`}</p></div><a href="#catalogo" className="text-link">Continuar comprando <ArrowRight size={16} /></a></div><div className="purchase-layout"><div>{checkout ? <CheckoutFields /> : <><div className="cart-columns"><span>PRODUTO</span><span>QUANTIDADE</span><span>SUBTOTAL</span></div>{loading ? <Skeleton label="Atualizando carrinho…" cards={2} /> : error ? <EmptyState title="Não foi possível atualizar o carrinho" description="Confira sua conexão antes de continuar."><Button onClick={() => setRevision(n => n + 1)}>Tentar novamente</Button></EmptyState> : !items.length ? <EmptyState icon={<ShoppingBag />} title="Seu carrinho está vazio" description="Explore a coleção e encontre peças com a sua identidade."><a href="#catalogo" className="button">Explorar catálogo <ArrowRight size={16} /></a></EmptyState> : items.map(item => { const p = products.find(p => p.id === item.productId); const v = p?.product_variants.find(v => v.id === item.variantId); return <article className="cart-item" key={item.variantId}><div className="cart-product">{p && <div className="cart-photo"><CatalogImage client={supabase!} path={p.product_images[0]?.path} alt={p.name} /></div>}<div><h3>{p?.name ?? 'Produto indisponível'}</h3>{p && <strong>{money(p.price_cents)}</strong>}<p className="muted">{v?.sku ?? 'Variação indisponível'}</p><small>{v && v.stock >= item.quantity ? 'Em estoque' : 'Estoque insuficiente ou produto indisponível'}</small></div></div><Quantity value={item.quantity} max={Math.max(1, v?.stock ?? 1)} onChange={q => change(item.variantId, q)} /><div><strong>{p ? money(p.price_cents * item.quantity) : '—'}</strong><button className="text-link" onClick={() => change(item.variantId, 0)}><Trash2 size={15} />Remover</button></div></article>; })}<div className="field-grid"><section className="panel"><h2>Cupom de desconto</h2><div className="inline-form"><input aria-label="Cupom" placeholder="Digite seu cupom" disabled /><Button disabled>APLICAR</Button></div><p className="muted">Cupons ainda não disponíveis.</p></section><section className="panel"><h2>Calcule o frete</h2><div className="inline-form"><input aria-label="CEP para frete" placeholder="00000-000" disabled /><Button disabled>CALCULAR</Button></div><p className="muted">Cálculo de entrega ainda não disponível.</p></section></div></> }</div>{summary}</div></div>{!checkout && <Catalog featured title="Você também pode gostar" />}</>;
}
function CheckoutFields() {
  return <div className="checkout-fields"><section className="panel"><h2><span className="step-number">1</span>Identificação</h2><div className="field-grid">{['Nome completo', 'E-mail', 'CPF', 'Telefone'].map(label => <label key={label}>{label}<input autoComplete="off" placeholder={label} disabled /></label>)}</div></section><section className="panel"><h2><span className="step-number">2</span>Entrega</h2><p className="muted">Para onde vamos enviar seu pedido?</p><div className="field-grid">{['CEP', 'Endereço', 'Número', 'Complemento', 'Bairro', 'Cidade', 'Estado'].map(label => <label key={label}>{label}<input placeholder={label} disabled /></label>)}</div><h3>Opções de entrega</h3><div className="delivery-options"><div><Truck /><strong>Entrega padrão</strong><small>Prazo e valor a consultar</small></div><div><Truck /><strong>Entrega expressa</strong><small>Ainda não disponível</small></div></div></section><section className="panel"><h2><span className="step-number">3</span>Pagamento</h2><p className="muted">As formas de pagamento serão disponibilizadas quando as compras forem habilitadas.</p>{['Cartão de crédito', 'Pix', 'Boleto bancário'].map(s => <div className="payment-option" key={s}><input type="radio" disabled aria-label={s} /><CreditCard /><span>{s}</span><small>Indisponível</small></div>)}</section></div>;
}
export function FavoritesPage() { return <><div className="shop-container"><div className="page-heading"><h1>Seus favoritos</h1><Heart /></div></div><Catalog favoritesOnly /></>; }
