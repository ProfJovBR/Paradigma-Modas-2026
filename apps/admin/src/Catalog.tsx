import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Pencil, Plus, RefreshCw, Save, Search, Trash2, Upload } from 'lucide-react';
import { Button, CatalogImage, EmptyState, Skeleton } from '@paradigma/ui';
import { money, validateImage, type Attribute, type Product, type ProductImage, type Variant } from '@paradigma/core';
import { attributes, checked, db, errorMessage, loadProduct, loadProducts } from './catalog-api';

import { CatalogMetrics } from './Metrics';
import { sizePresets, colorPresets } from './attribute-presets';

export function CatalogProducts({ initialQuery = '' }: { initialQuery?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery); const [status, setStatus] = useState('');
  const [rows, setRows] = useState<Product[]>([]); const [count, setCount] = useState(0); const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  useEffect(() => { setQuery(initialQuery); setPage(0); }, [initialQuery]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const timer = setTimeout(() => { void loadProducts(page, query, status).then(result => { if (active) { setRows(result.rows); setCount(result.count); } }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [page, query, status, refresh]);
  if (selected) return <ProductEditor key={selected} id={selected} onClose={() => { setSelected(null); setRefresh(n => n + 1); }} />;
  return <section><div className="catalog-admin-heading"><Button onClick={() => setSelected('new')}><Plus size={18} />Novo produto</Button></div><CatalogMetrics key={refresh} /><div className="tabs product-tabs">{[{ label: 'Todos', value: '' }, { label: 'Ativos', value: 'active' }, { label: 'Rascunhos', value: 'draft' }, { label: 'Arquivados', value: 'archived' }].map(t => <button key={t.value} aria-pressed={status === t.value} onClick={() => { setStatus(t.value); setPage(0); }}>{t.label}</button>)}<a href="#atributos">Gerenciar categorias →</a></div><div className="list-tools"><label className="search-field"><Search size={18} /><input type="search" placeholder="Buscar produtos por nome" aria-label="Buscar produtos por nome" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label><select aria-label="Status dos produtos" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">Todos os status</option><option value="draft">Rascunhos</option><option value="active">Publicados</option><option value="archived">Arquivados</option></select></div>{loading ? <Skeleton label="Carregando produtos…" /> : error ? <Failure message={error} retry={() => setRefresh(refresh + 1)} /> : !rows.length ? <section className="panel"><EmptyState title="Nenhum produto cadastrado" description="Cadastre suas peças e mantenha seu catálogo atualizado."><Button onClick={() => setSelected('new')}><Plus size={16} />Cadastrar produto</Button></EmptyState></section> : <><div className="admin-product-table"><div className="admin-product-table-head"><span>PRODUTO</span><span>SKU</span><span>ESTOQUE</span><span>PREÇO</span><span>STATUS</span><span>AÇÕES</span></div>{rows.map(p => <div className="product-admin-row" key={p.id}><div className="admin-product-name"><div className="admin-thumb"><CatalogImage client={db()} path={[...p.product_images].sort((a,b) => a.position - b.position)[0]?.path} alt={p.name} /></div><h3>{p.name}</h3></div><span className="table-sku" data-label="SKU">{p.product_variants.map(v => v.sku).join(', ') || 'Sem variantes'}</span><span data-label="Estoque">{p.product_variants.reduce((total, v) => total + v.stock, 0)}</span><strong data-label="Preço">{money(p.price_cents)}</strong><span className={`badge status-${p.status}`}>{{ draft: 'Rascunho', active: 'Ativo', archived: 'Arquivado' }[p.status]}</span><Button className="secondary" onClick={() => setSelected(p.id)}><Pencil size={16} />Editar</Button></div>)}</div><div className="pagination"><span>{count} produtos encontrados</span><Button className="secondary" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ArrowLeft size={16} /></Button><span>{page + 1} de {Math.max(1, Math.ceil(count / 20))}</span><Button className="secondary" disabled={(page + 1) * 20 >= count} onClick={() => setPage(page + 1)} aria-label="Próxima página"><ArrowRight size={16} /></Button></div></>}</section>;
}
export function Failure({ message, retry }: { message: string; retry: () => void }) { return <div className="feedback error" role="alert"><p>{message}</p><Button className="secondary" onClick={retry}><RefreshCw size={16} />Tentar novamente</Button></div>; }

function ProductEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const [product, setProduct] = useState<Product | null>(null); const [productId, setProductId] = useState(id);
  const [categories, setCategories] = useState<Attribute[]>([]);
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [price, setPrice] = useState(''); const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void Promise.all([attributes('categories'), productId === 'new' ? Promise.resolve(null) : loadProduct(productId)]).then(([cats,p]) => {
      if (!active) return; setCategories(cats); setProduct(p); setName(p?.name ?? ''); setDescription(p?.description ?? ''); setPrice(p ? (p.price_cents / 100).toFixed(2) : ''); setCategory(p?.category_id ?? '');
    }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, retry]);
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = { name: name.trim(), description, price_cents: Math.round(Number(price) * 100), category_id: category || null };
      const request = product ? db().from('products').update(payload).eq('id', product.id).eq('updated_at', product.updated_at) : db().from('products').insert({ ...payload, status: 'draft' });
      const { data, error } = await request.select().maybeSingle();
      if (error) throw error;
      if (!data) { setError('O produto mudou em outra sessão ou seu acesso foi revogado. Recarregue antes de salvar.'); return; }
      setProduct({ ...data, product_variants: product?.product_variants ?? [], product_images: product?.product_images ?? [] } as Product); setProductId(data.id); setNotice('Produto salvo.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function changeStatus(status: Product['status']) {
    if (!product) return;
    if (!window.confirm(status === 'active' ? 'Publicar este produto na loja? As alterações não salvas não serão incluídas.' : 'Retirar este produto da exposição pública?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error } = await db().from('products').update({ status }).eq('id', product.id).eq('updated_at', product.updated_at).select().maybeSingle();
      if (error) throw error;
      if (!data) { setError('O produto mudou ou seu acesso foi revogado. Recarregue a tela.'); return; }
      setProduct({ ...product, ...data }); setNotice(status === 'active' ? 'Produto publicado.' : 'Produto retirado da exposição pública.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="editor"><div className="subheading"><h2>{productId === 'new' ? 'Novo produto' : 'Editar produto'}</h2><Button className="secondary" onClick={onClose}><ArrowLeft size={16} />Voltar</Button></div>{loading ? <p role="status">Carregando produto…</p> : <>{error && <Failure message={error} retry={() => setRetry(retry + 1)} />}{notice && <p role="status" className="feedback">{notice}</p>}<form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={busy || (!!error && !product && productId !== 'new')} className="form-section"><h2>Informações do produto</h2><label>Nome<input required maxLength={160} value={name} onChange={e => setName(e.target.value)} /></label><label>Descrição<textarea rows={4} maxLength={10000} value={description} onChange={e => setDescription(e.target.value)} /></label><div className="field-grid"><label>Preço (R$)<input type="number" required min="0.01" max="1000000" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label><label>Categoria<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Sem categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><Button disabled={busy}><Save size={17} />{busy ? 'Salvando…' : 'Salvar produto'}</Button></fieldset></form>{product && <><div className="form-section action-row"><span className="badge">{{ draft: 'Rascunho', active: 'Publicado', archived: 'Arquivado' }[product.status]}</span>{product.status !== 'active' && <Button disabled={busy} onClick={() => void changeStatus('active')}>Publicar produto</Button>}{product.status === 'active' && <Button className="secondary" disabled={busy} onClick={() => void changeStatus('draft')}>Voltar a rascunho</Button>}{product.status !== 'archived' && <Button className="secondary" disabled={busy} onClick={() => void changeStatus('archived')}>Arquivar produto</Button>}</div><Variants productId={product.id} /><Images productId={product.id} /></>}{!product && <p className="muted">Salve o rascunho para adicionar variantes, estoque e fotos.</p>}</>}</div>;
}

function Variants({ productId }: { productId: string }) {
  const [rows, setRows] = useState<Variant[]>([]); const [sizes, setSizes] = useState<Attribute[]>([]); const [colors, setColors] = useState<Attribute[]>([]);
  const [editing, setEditing] = useState<Variant | null>(null); const [size, setSize] = useState(''); const [color, setColor] = useState(''); const [sku, setSku] = useState(''); const [stock, setStock] = useState('0');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; setLoading(true); void Promise.all([loadProduct(productId), attributes('sizes'), attributes('colors')]).then(([p,s,c]) => { if (active) { setRows(p.product_variants); setSizes(s); setColors(c); } }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [productId, revision]);
  function reset() { setEditing(null); setSize(''); setColor(''); setSku(''); setStock('0'); }
  async function save() {
    setBusy(true); setError('');
    try {
      const payload = { product_id: productId, size_id: size, color_id: color, sku: sku.trim(), stock: Number(stock) };
      const request = editing ? db().from('product_variants').update(payload).eq('id', editing.id).eq('updated_at', editing.updated_at) : db().from('product_variants').insert(payload);
      const { data } = await checked(request.select().maybeSingle());
      if (!data) { setError('A variante mudou em outra sessão ou seu acesso foi revogado. Atualize a lista.'); return; }
      reset(); setRevision(n => n + 1);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function remove(v: Variant) {
    if (!window.confirm(`Excluir a variante ${v.sku}?`)) return;
    setBusy(true); setError('');
    try { const { data } = await checked(db().from('product_variants').delete().eq('id', v.id).eq('updated_at', v.updated_at).select()); if (!data?.length) throw new Error('conflict'); if (editing?.id === v.id) reset(); setRevision(n => n + 1); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <section className="form-section"><h2>Variantes e estoque</h2>{error && <Failure message={error} retry={() => { setError(''); setRevision(n => n + 1); }} />}{loading ? <p role="status">Carregando variantes…</p> : rows.length ? <div className="variant-list">{rows.map(v => <div key={v.id} className="variant-row"><span><strong>{v.sku}</strong><small>{sizes.find(s => s.id === v.size_id)?.name} / {colors.find(c => c.id === v.color_id)?.name} · Estoque: {v.stock}</small></span><button disabled={busy} className="icon-button" title="Editar variante" aria-label={`Editar ${v.sku}`} onClick={() => { setEditing(v); setSize(v.size_id); setColor(v.color_id); setSku(v.sku); setStock(String(v.stock)); }}><Pencil size={17} /></button><button disabled={busy} className="icon-button" title="Excluir variante" aria-label={`Excluir ${v.sku}`} onClick={() => void remove(v)}><Trash2 size={17} /></button></div>)}</div> : <p className="muted">Nenhuma variante cadastrada.</p>}<form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={busy || loading}><div className="field-grid"><label>Tamanho<select required value={size} onChange={e => setSize(e.target.value)}><option value="">Selecione</option>{sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Cor<select required value={color} onChange={e => setColor(e.target.value)}><option value="">Selecione</option>{colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>SKU<input required maxLength={80} value={sku} onChange={e => setSku(e.target.value)} /></label><label>Estoque<input required type="number" min="0" max="1000000" step="1" value={stock} onChange={e => setStock(e.target.value)} /></label></div><div className="action-row"><Button><Save size={16} />{editing ? 'Salvar variante' : 'Adicionar variante'}</Button>{editing && <Button type="button" className="secondary" onClick={reset}>Cancelar edição</Button>}</div></fieldset></form></section>;
}

function Images({ productId }: { productId: string }) {
  const [rows, setRows] = useState<ProductImage[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; setLoading(true); void loadProduct(productId).then(p => { if (active) setRows(p.product_images.sort((a,b) => a.position - b.position)); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [productId, revision]);
  async function upload(file: File) {
    setBusy(true); setError(''); let metadataId: string | null = null;
    try {
      let extension: string;
      try { extension = await validateImage(file); } catch (e) { setError((e as Error).message); return; }
      const path = `${productId}/${crypto.randomUUID()}.${extension}`;
      const { data } = await checked(db().from('product_images').insert({ product_id: productId, path, position: Math.min(10000, Math.max(-1, ...rows.map(r => r.position)) + 1) }).select().single());
      metadataId = data.id;
      await checked(db().storage.from('catalog').upload(path, file, { contentType: file.type, cacheControl: '0', upsert: false }));
      setRevision(n => n + 1);
    } catch (e) {
      if (metadataId) {
        const cleanup = await db().from('product_images').delete().eq('id', metadataId);
        if (cleanup.error) { setError('Falha no upload e na limpeza do registro. Atualize a lista e remova a foto incompleta.'); setRevision(n => n + 1); return; }
      }
      setError(errorMessage(e));
    } finally { setBusy(false); }
  }
  async function remove(image: ProductImage) {
    if (!window.confirm('Remover esta foto do produto?')) return;
    setBusy(true); setError('');
    try {
      await checked(db().storage.from('catalog').remove([image.path]));
      const { data } = await checked(db().from('product_images').delete().eq('id', image.id).select());
      if (!data?.length) throw new Error('permission');
      setRevision(n => n + 1);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function saveMetadata(image: ProductImage) {
    setBusy(true); setError('');
    try { const { data } = await checked(db().from('product_images').update({ alt: image.alt, position: image.position }).eq('id', image.id).select()); if (!data?.length) throw new Error('permission'); setRevision(n => n + 1); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <section className="form-section"><h2>Fotos</h2>{error && <Failure message={error} retry={() => { setError(''); setRevision(n => n + 1); }} />}<label className="upload-placeholder"><Upload size={24} /><span>Adicionar foto · JPEG, PNG ou WebP · até 5 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || loading} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }} /></label>{busy && <p role="status">Atualizando fotos…</p>}{loading ? <p role="status">Carregando fotos…</p> : <div className="image-editor-grid">{rows.map(img => <form key={img.id} onSubmit={e => { e.preventDefault(); void saveMetadata(img); }}><CatalogImage client={db()} path={img.path} alt={img.alt} /><label>Descrição da foto<input maxLength={300} value={img.alt} onChange={e => setRows(rows.map(r => r.id === img.id ? { ...r, alt: e.target.value } : r))} /></label><label>Ordem<input type="number" required min="0" max="10000" step="1" value={img.position} onChange={e => setRows(rows.map(r => r.id === img.id ? { ...r, position: Number(e.target.value) } : r))} /></label><div className="action-row"><Button disabled={busy} className="secondary"><Save size={16} />Salvar foto</Button><button type="button" disabled={busy} className="icon-button" title="Remover foto" aria-label="Remover foto" onClick={() => void remove(img)}><Trash2 size={17} /></button></div></form>)}</div>}</section>;
}

export function CatalogAttributes() {
  const [table, setTable] = useState<'categories' | 'sizes' | 'colors'>('categories');
  return <section><div className="tabs" role="group" aria-label="Atributos do catálogo">{(['categories', 'sizes', 'colors'] as const).map(t => <button key={t} aria-pressed={table === t} onClick={() => setTable(t)}>{{ categories: 'Categorias', sizes: 'Tamanhos', colors: 'Cores' }[t]}</button>)}</div><AttributeEditor key={table} table={table} /></section>;
}
function AttributeEditor({ table }: { table: 'categories' | 'sizes' | 'colors' }) {
  const [notice, setNotice] = useState('');
  const presets: { name: string; hex?: string }[] = table === 'sizes' ? sizePresets : table === 'colors' ? colorPresets : [];

  const [rows, setRows] = useState<Attribute[]>([]); const [name, setName] = useState(''); const [hex, setHex] = useState('#ffdf32'); const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; setLoading(true); void attributes(table).then(data => { if (active) setRows(data); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [table, revision]);
  const normalize = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
  const missingPresets = presets.filter(preset => !rows.some(row => normalize(row.name) === normalize(preset.name)));
  async function addPresets() {
    setBusy(true); setError(''); setNotice('');
    try {
      const existing = await attributes(table);
      const missing = presets.filter(preset => !existing.some(row => normalize(row.name) === normalize(preset.name)));
      if (missing.length) {
        await checked(db().from(table).upsert(missing, { onConflict: 'name', ignoreDuplicates: true }).select());
      }
      const saved = await attributes(table);
      if (!presets.every(preset => saved.some(row => normalize(row.name) === normalize(preset.name)))) throw new Error('permission');
      setRows(saved);
      setNotice('Opções padrão cadastradas. Você pode editar os nomes e as cores abaixo.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError('');
    try { const payload = { name: name.trim(), ...(table === 'colors' ? { hex } : {}) }; const { data } = await checked((id ? db().from(table).update(payload).eq('id', id) : db().from(table).insert(payload)).select()); if (!data?.length) throw new Error('permission'); setId(null); setName(''); setRevision(n => n + 1); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function remove(row: Attribute) {
    if (!window.confirm(`Excluir ${row.name}? Registros em uso não podem ser excluídos.`)) return;
    setBusy(true); setError('');
    try { const { data } = await checked(db().from(table).delete().eq('id', row.id).select()); if (!data?.length) throw new Error('permission'); if (id === row.id) { setId(null); setName(''); } setRevision(n => n + 1); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="form-section">{presets.length > 0 && <section aria-label="Opções padrão"><h2>{table === 'sizes' ? 'Tamanhos padrão' : 'Cores padrão'}</h2><p className="muted">Cadastre as opções que faltam de uma vez. Os registros existentes serão preservados.</p><div className="action-row" style={{ flexWrap: 'wrap' }}>{presets.map(preset => <span className="badge" key={preset.name}>{preset.hex && <span className="color-swatch" style={{ background: preset.hex, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />}{preset.name}</span>)}</div><Button type="button" disabled={busy || loading || !!error || !missingPresets.length} onClick={() => void addPresets()}><Plus size={16} />{busy ? 'Cadastrando…' : !loading && !missingPresets.length ? 'Opções padrão já cadastradas' : 'Cadastrar opções padrão'}</Button></section>}{notice && <p role="status" className="feedback">{notice}</p>}{error && <Failure message={error} retry={() => { setError(''); setRevision(n => n + 1); }} />}{loading ? <p role="status">Carregando registros…</p> : !rows.length ? <EmptyState title="Nenhum registro cadastrado" description="Adicione os atributos reais do seu catálogo." /> : rows.map(row => <div className="variant-row" key={row.id}>{row.hex && <span className="color-swatch" style={{ background: row.hex }} />}<span>{row.name}</span><button className="icon-button" title="Editar" aria-label={`Editar ${row.name}`} disabled={busy} onClick={() => { setId(row.id); setName(row.name); setHex(row.hex ?? '#ffdf32'); }}><Pencil size={16} /></button><button className="icon-button" title="Excluir" aria-label={`Excluir ${row.name}`} disabled={busy} onClick={() => void remove(row)}><Trash2 size={16} /></button></div>)}<form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={busy || loading}><h2>{id ? 'Editar registro' : 'Novo registro'}</h2><label>Nome<input required maxLength={table === 'sizes' ? 40 : table === 'colors' ? 60 : 100} value={name} onChange={e => setName(e.target.value)} /></label>{table === 'colors' && <label>Cor<input type="color" value={hex} onChange={e => setHex(e.target.value)} /></label>}<div className="action-row"><Button><Save size={16} />Salvar</Button>{id && <Button type="button" className="secondary" onClick={() => { setId(null); setName(''); }}>Cancelar</Button>}</div></fieldset></form></div>;
}
