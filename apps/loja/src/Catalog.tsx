import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { Button, CatalogImage, EmptyState } from '@paradigma/ui';
import { money, productSelect, type Product, type Attribute } from '@paradigma/core';
import { supabase } from './supabase';

function useRevalidation() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setRevision(n => n + 1); };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return [revision, () => setRevision(n => n + 1)] as const;
}
function RequestError({ retry }: { retry: () => void }) { return <EmptyState title="Não foi possível carregar o catálogo" description="Tente novamente em alguns instantes."><Button className="secondary" onClick={retry}><RefreshCw size={16} />Tentar novamente</Button></EmptyState>; }

export function Catalog() {
  const [query, setQuery] = useState(''); const [category, setCategory] = useState(''); const [sort, setSort] = useState('recent'); const [page, setPage] = useState(0); const [filters, setFilters] = useState(false);
  const [products, setProducts] = useState<Product[]>([]); const [categories, setCategories] = useState<Attribute[]>([]); const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(!!supabase); const [error, setError] = useState(false); const [revision, refresh] = useRevalidation();
  useEffect(() => {
    if (!supabase) return;
    let active = true; setLoading(true); setError(false);
    const timer = setTimeout(() => {
      let request = supabase!.from('products').select(productSelect, { count: 'exact' }).eq('status', 'active').order(sort === 'recent' ? 'created_at' : 'price_cents', { ascending: sort === 'low' }).order('id').range(page * 12, page * 12 + 11);
      if (query.trim()) request = request.ilike('name', `%${query.trim().replace(/[%_]/g, '')}%`);
      if (category) request = request.eq('category_id', category);
      void Promise.all([request, supabase!.from('categories').select('*').order('name')]).then(([result, cats]) => {
        if (!active) return;
        if (result.error || cats.error) { setError(true); setProducts([]); return; }
        setProducts(result.data as Product[]); setCount(result.count ?? 0); setCategories(cats.data);
      }).catch(() => { if (active) { setError(true); setProducts([]); } }).finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, category, sort, page, revision]);
  return <section id="catalogo" className="store-catalog"><div className="section-heading"><div><span className="eyebrow">ESCOLHAS QUE SÃO SUAS</span><h2>Nosso catálogo</h2></div><span className="muted">{supabase && !loading && !error ? `${count} peças` : 'PARADIGMA'}</span></div><div className="catalog-toolbar"><label className="search-field"><Search size={18} /><input type="search" aria-label="Buscar peças" placeholder="O que você procura?" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label><Button className="secondary" aria-expanded={filters} onClick={() => setFilters(!filters)}><SlidersHorizontal size={17} />Filtros</Button><label className="sort-label"><span>Ordenar por</span><select aria-label="Ordenar produtos" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="recent">Mais recentes</option><option value="low">Menor preço</option><option value="high">Maior preço</option></select></label></div>{filters && <div className="filter-empty"><label>Categoria<select aria-label="Categoria" value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}><option value="">Todas as categorias</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><Button className="secondary" onClick={() => { setCategory(''); setQuery(''); setPage(0); }}>Limpar filtros</Button></div>}{!supabase ? <EmptyState title="Catálogo temporariamente indisponível" description="Volte em breve para descobrir as peças da PARADIGMA." /> : loading ? <div className="empty-state" role="status">Carregando catálogo…</div> : error ? <RequestError retry={refresh} /> : !products.length ? <EmptyState title={query || category ? 'Nenhuma peça encontrada' : 'Novas peças a caminho'} description={query || category ? 'Tente outra busca ou remova os filtros.' : 'Ainda não há peças publicadas no catálogo.'}>{(query || category) && <Button className="secondary" onClick={() => { setQuery(''); setCategory(''); setPage(0); }}>Limpar busca</Button>}</EmptyState> : <><div className="catalog-grid">{products.map(product => <a className="product-card" key={product.id} href={`#produto/${product.id}`}><CatalogImage client={supabase!} path={[...product.product_images].sort((a,b) => a.position - b.position)[0]?.path} alt={product.product_images[0]?.alt || product.name} /><h3>{product.name}</h3><strong>{money(product.price_cents)}</strong>{!product.product_variants.some(v => v.stock > 0) && <small>Sem estoque</small>}</a>)}</div><div className="pagination"><Button className="secondary" disabled={page === 0} aria-label="Página anterior" onClick={() => setPage(page - 1)}><ArrowLeft size={16} /></Button><span>{page + 1} de {Math.max(1, Math.ceil(count / 12))}</span><Button className="secondary" disabled={(page + 1) * 12 >= count} aria-label="Próxima página" onClick={() => setPage(page + 1)}><ArrowRight size={16} /></Button></div></>}</section>;
}

export function ProductPage({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null); const [sizes, setSizes] = useState<Attribute[]>([]); const [colors, setColors] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [variantId, setVariantId] = useState(''); const [imageId, setImageId] = useState(''); const [revision, refresh] = useRevalidation();
  useEffect(() => {
    let active = true; setLoading(true); setError(false);
    if (!supabase || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) { setProduct(null); setLoading(false); return; }
    void Promise.all([supabase!.from('products').select(productSelect).eq('id', id).eq('status', 'active').maybeSingle(), supabase!.from('sizes').select('*'), supabase!.from('colors').select('*')]).then(([p,s,c]) => {
      if (!active) return;
      if (p.error || s.error || c.error) { setError(true); setProduct(null); return; }
      setProduct(p.data as Product | null); setSizes(s.data); setColors(c.data);
    }).catch(() => { if (active) { setError(true); setProduct(null); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, revision]);
  const images = [...(product?.product_images ?? [])].sort((a,b) => a.position - b.position);
  const selectedImage = images.find(img => img.id === imageId) ?? images[0];
  const variant = product?.product_variants.find(v => v.id === variantId);
  return <section className="product-page"><a className="text-link" href="#catalogo"><ArrowLeft size={16} />Voltar ao catálogo</a>{loading ? <div className="empty-state" role="status">Carregando produto…</div> : error ? <RequestError retry={refresh} /> : !product || !supabase ? <EmptyState title="Produto indisponível" description="Esta peça não está disponível no catálogo. Explore outras opções." /> : <div className="product-detail"><div><CatalogImage client={supabase!} path={selectedImage?.path} alt={selectedImage?.alt || product.name} />{images.length > 1 && <div className="product-thumbnails">{images.map((img, index) => <button key={img.id} aria-label={`Foto ${index + 1}`} aria-pressed={selectedImage?.id === img.id} onClick={() => setImageId(img.id)}><CatalogImage client={supabase!} path={img.path} alt={img.alt || product.name} /></button>)}</div>}</div><div className="product-info"><span className="eyebrow">PARADIGMA</span><h1>{product.name}</h1><strong className="product-price">{money(product.price_cents)}</strong><p className="product-description">{product.description}</p><label>Tamanho e cor<select value={variantId} onChange={e => setVariantId(e.target.value)}><option value="">Selecione uma opção</option>{product.product_variants.map(v => <option key={v.id} value={v.id}>{sizes.find(s => s.id === v.size_id)?.name ?? 'Tamanho'} / {colors.find(c => c.id === v.color_id)?.name ?? 'Cor'}{v.stock === 0 ? ' · Sem estoque' : ''}</option>)}</select></label><p className="stock-label">{variant ? variant.stock > 0 ? 'Em estoque' : 'Esta opção está sem estoque' : product.product_variants.some(v => v.stock > 0) ? 'Selecione uma opção para consultar a disponibilidade.' : 'Produto sem estoque'}</p><p className="muted">Compras online ainda não estão disponíveis.</p></div></div>}</section>;
}
