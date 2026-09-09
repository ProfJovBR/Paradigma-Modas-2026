import { errorMessage, productSelect, type Product, type Attribute } from '@paradigma/core';
import { supabase } from './supabase';

export function db() { if (!supabase) throw new Error('Supabase não configurado.'); return supabase; }
export async function loadProducts(page = 0, query = '', status = '') {
  let request = db().from('products').select(productSelect, { count: 'exact' }).order('created_at', { ascending: false }).range(page * 20, page * 20 + 19);
  if (query.trim()) request = request.ilike('name', `%${query.trim().replace(/[%_]/g, '')}%`);
  if (status) request = request.eq('status', status);
  const { data, error, count } = await request;
  if (error) throw error;
  return { rows: data as Product[], count: count ?? 0 };
}
export async function loadProduct(id: string) {
  const { data, error } = await db().from('products').select(productSelect).eq('id', id).single();
  if (error) throw error; return data as Product;
}
export async function attributes(table: 'categories' | 'sizes' | 'colors') {
  const result: Attribute[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await db().from(table).select('*').order('name').range(from, from + 499);
    if (error) throw error;
    result.push(...data as Attribute[]); if (data.length < 500) return result;
  }
}
export async function checked<T extends { error: unknown }>(promise: PromiseLike<T>) {
  const result = await promise; if (result.error) throw result.error; return result;
}
export { errorMessage };
