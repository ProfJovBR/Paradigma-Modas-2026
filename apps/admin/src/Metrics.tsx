import { useEffect, useState } from 'react';
import { FileText, Folder, Package, ShoppingBag } from 'lucide-react';
import { supabase } from './supabase';
export function CatalogMetrics() {
  const [values, setValues] = useState<(number | null)[]>([null, null, null, null]);
  useEffect(() => { let active = true; if (supabase) void Promise.all([supabase.from('products').select('id', { count: 'exact', head: true }), supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'), supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'draft'), supabase.from('categories').select('id', { count: 'exact', head: true })]).then(results => { if (active) setValues(results.map(r => r.error ? null : r.count)); }); return () => { active = false; }; }, []);
  return <div className="stats-grid">{[{ label: 'Total de produtos', icon: Package }, { label: 'Produtos publicados', icon: ShoppingBag }, { label: 'Rascunhos', icon: FileText }, { label: 'Categorias', icon: Folder }].map((item, index) => <section className="stat" key={item.label}><item.icon /><span>{item.label}</span><strong>{values[index] ?? '—'}</strong><small>{values[index] === null ? 'Dados indisponíveis' : 'Catálogo atual'}</small></section>)}</div>;
}
