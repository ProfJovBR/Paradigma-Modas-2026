import { createClient } from '@supabase/supabase-js';
export * from './banners';
export type { SupabaseClient, Session } from '@supabase/supabase-js';
export type Attribute = { id: string; name: string; hex?: string };
export type Variant = { id: string; product_id: string; size_id: string; color_id: string; sku: string; stock: number; updated_at: string };
export type ProductImage = { id: string; product_id: string; path: string; alt: string; position: number };
export type Product = { id: string; name: string; description: string; price_cents: number; status: 'draft' | 'active' | 'archived'; category_id: string | null; created_at: string; updated_at: string; product_variants: Variant[]; product_images: ProductImage[] };
export type Promotion = { id: string; name: string; mode: 'global' | 'individual'; globalPercent: number | null; items: { productId: string; percent: number | null }[] };
export const productSelect = '*, product_variants(*), product_images(*)';
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export function createSupabaseClient(url: string, publishableKey: string, admin = false) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || !publishableKey.startsWith('sb_publishable_')) throw new Error('Configure a URL do projeto e uma chave publishable do Supabase.');
  return createClient(url, publishableKey, {
    auth: { persistSession: admin, autoRefreshToken: admin, detectSessionInUrl: false, storageKey: 'paradigma-admin-auth' },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
export function configuredClient(admin = false) {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return { client: null, configurationError: 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local desta aplicação.' };
  try { return { client: createSupabaseClient(url, key, admin), configurationError: '' }; }
  catch { return { client: null, configurationError: 'Configuração inválida. Use a URL HTTP(S) do projeto e uma chave pública sb_publishable_. Reinicie o Vite.' }; }
}
export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === '23505') return 'Já existe um registro com esse nome, SKU ou combinação de tamanho e cor.';
  if (code === '23503') return 'Registro em uso ou referência indisponível. Atualize a tela e verifique as associações.';
  if (code === '42501') return 'Operação não autorizada. Verifique a sessão e a permissão administrativa.';
  if (code === '23514') return 'Valores inválidos. Confira os limites dos campos.';
  return 'Não foi possível concluir a operação. Verifique a conexão, a sessão e a configuração do banco e tente novamente.';
}
export async function validateImage(file: File) {
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!extensions[file.type] || file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('Envie JPEG, PNG ou WebP de até 5 MB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signature = file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
      : String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (!signature) throw new Error('O conteúdo do arquivo não corresponde ao tipo de imagem.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('Imagem inválida ou corrompida.'); }
  const valid = bitmap.width <= 8000 && bitmap.height <= 8000 && bitmap.width * bitmap.height <= 32000000;
  bitmap.close();
  if (!valid) throw new Error('A imagem deve ter até 8000 pixels por lado e 32 megapixels.');
  return extensions[file.type];
}
