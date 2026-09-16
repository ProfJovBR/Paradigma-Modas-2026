import type { BrowserContext } from '@playwright/test';

// In-memory HTTP fixtures only. These do not prove hosted Supabase permissions.
export async function mockSupabase(context: BrowserContext) {
  const tables: Record<string, Record<string, any>[]> = { products: [], categories: [], sizes: [], colors: [], product_variants: [], product_images: [] };
  const files = new Map<string, Buffer>();
  const state = { failReads: false, denyLogin: false, email: '', failTheme: false, failThemeLoad: false };
  let theme = { draft: null as Record<string, string> | null, published: null as Record<string, string> | null, revision: crypto.randomUUID() };
  await context.route('https://supabase.test/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const json = (data: unknown, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-expose-headers': 'content-range', ...headers } });
    if (url.pathname.endsWith('/token')) {
      if (state.denyLogin) return json({ error: 'invalid_grant', error_description: 'Invalid credentials' },400);
      state.email = request.postDataJSON().email;
      const user = { id:'00000000-0000-4000-8000-000000000001', aud:'authenticated', email:state.email, role:'authenticated', app_metadata:{},user_metadata:{}, created_at:new Date().toISOString() };
      const payload = Buffer.from(JSON.stringify({ sub:user.id, exp:Math.floor(Date.now()/1000)+3600, aud:'authenticated', role:'authenticated' })).toString('base64url');
      return json({ access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.test`, refresh_token:'test-refresh', token_type:'bearer', expires_in:3600, user });
    }
    if (url.pathname.endsWith('/logout')) return json({});
    if (url.pathname.endsWith('/rpc/is_admin')) return json(state.email !== 'common@example.test');
    if (url.pathname.endsWith('/rpc/get_theme_editor')) return state.failThemeLoad ? json({ code: 'PGRST202' }, 404) : json(theme);
    if (url.pathname.endsWith('/rpc/save_theme')) {
      if (state.failTheme) return json({ message: 'offline' }, 503);
      const body = request.postDataJSON();
      if (body.p_revision !== theme.revision) return json({ code: '40001' }, 409);
      theme = { draft: body.p_tokens, published: body.p_publish ? body.p_tokens : theme.published, revision: crypto.randomUUID() };
      return json(theme);
    }
    if (url.pathname.endsWith('/theme_settings')) return json([{ published: theme.published }]);
    if (url.pathname.includes('/storage/v1/object/')) {
      const path = decodeURIComponent(url.pathname.split('/catalog/')[1] ?? '');
      if (method === 'POST') {
        let bytes = request.postDataBuffer()!;
        if (request.headers()['content-type']?.startsWith('multipart/form-data')) {
          const form = await new Response(new Uint8Array(bytes), { headers: { 'content-type': request.headers()['content-type'] } }).formData();
          const file = [...form.values()].find(value => typeof value !== 'string') as File;
          bytes = Buffer.from(await file.arrayBuffer());
        }
        files.set(path,bytes); return json({ Key:`catalog/${path}`, Id:crypto.randomUUID() });
      }
      if (method === 'DELETE') { const body = request.postDataJSON(); for (const p of body.prefixes ?? []) files.delete(p); return json([]); }
      const file = files.get(path); return file ? route.fulfill({status:200,contentType:'image/png',body:file}) : json({message:'not found'},404);
    }
    const table = url.pathname.split('/rest/v1/')[1];
    if (!tables[table]) return json({message:'Unexpected test request'},500);
    if (state.failReads && (method === 'GET' || method === 'HEAD')) return json({message:'offline'},503);
    const matches = (row: Record<string,any>) => [...url.searchParams.entries()].every(([key,value]) => {
      if (key.startsWith('product_variants.')) return tables.product_variants.some(v => v.product_id === row.id && String(v[key.split('.')[1]]) === value.slice(3));
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
      if (value.startsWith('neq.')) return String(row[key]) !== value.slice(4);
      if (value.startsWith('lte.')) return Number(row[key]) <= Number(value.slice(4));
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]));
      if (value.startsWith('ilike.')) return String(row[key]).toLowerCase().includes(value.slice(6).replaceAll('%','').toLowerCase());
      return true;
    });
    let selected = tables[table].filter(matches);
    if (method === 'POST') {
      const body = request.postDataJSON();
      selected = [];
      for (const item of Array.isArray(body) ? body : [body]) {
        if (request.headers().prefer?.includes('resolution=ignore-duplicates') && tables[table].some(row => row.name === item.name)) continue;
        const row = { id:crypto.randomUUID(), created_at:new Date().toISOString(),updated_at:new Date().toISOString(), ...item };
        tables[table].push(row); selected.push(row);
      }
    }
    if (method === 'PATCH') for (const row of selected) Object.assign(row,request.postDataJSON(),{updated_at:new Date().toISOString()});
    if (method === 'DELETE') tables[table] = tables[table].filter(row => !selected.includes(row));
    const count = selected.length;
    if (table === 'products' && url.searchParams.get('select')?.includes('product_variants')) selected = selected.map(p => ({...p, product_variants:tables.product_variants.filter(v=>v.product_id===p.id),product_images:tables.product_images.filter(i=>i.product_id===p.id)}));
    if (url.searchParams.has('limit')) selected = selected.slice(Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('offset') ?? 0) + Number(url.searchParams.get('limit')));
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
    return json(single ? selected[0] : selected,200,{'content-range':`0-${Math.max(0,count-1)}/${count}`});
  });
  return { tables, state, files };
}
