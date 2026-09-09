import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Run only in a dedicated, disposable staging project. Never print credentials/errors.
const env = process.env;
const required = ['PARADIGMA_TEST_URL','PARADIGMA_TEST_PUBLISHABLE_KEY','PARADIGMA_TEST_ADMIN_EMAIL','PARADIGMA_TEST_ADMIN_PASSWORD','PARADIGMA_TEST_USER_EMAIL','PARADIGMA_TEST_USER_PASSWORD'];
if (env.PARADIGMA_TEST_ALLOW_WRITES !== 'isolated-staging' || required.some(k => !env[k]) || !env.PARADIGMA_TEST_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
  console.error('Não executado: configure as variáveis de teste e PARADIGMA_TEST_ALLOW_WRITES=isolated-staging. Consulte docs/etapa-02.md.');
  process.exit(1);
}
const makeClient = () => createClient(env.PARADIGMA_TEST_URL, env.PARADIGMA_TEST_PUBLISHABLE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
const admin = makeClient(), user = makeClient(), anon = makeClient();
let product, imagePath, imageId, category, size, color;
const suffix = crypto.randomUUID();
let stage = 'autenticacao'; let cleanupFailed = false;
async function ok(result) { assert.equal(result.error, null, `Falha na etapa ${stage}`); return result.data; }
try {
  await ok(await admin.auth.signInWithPassword({email:env.PARADIGMA_TEST_ADMIN_EMAIL,password:env.PARADIGMA_TEST_ADMIN_PASSWORD}));
  await ok(await user.auth.signInWithPassword({email:env.PARADIGMA_TEST_USER_EMAIL,password:env.PARADIGMA_TEST_USER_PASSWORD}));
  assert.equal(await ok(await admin.rpc('is_admin')),true);
  assert.equal(await ok(await user.rpc('is_admin')),false);
  stage = 'cadastro privado';
  category = (await ok(await admin.from('categories').insert({name:`Teste isolado ${suffix}`}).select().single())).id;
  size = (await ok(await admin.from('sizes').insert({name:suffix}).select().single())).id;
  color = (await ok(await admin.from('colors').insert({name:suffix,hex:'#123456'}).select().single())).id;
  product = (await ok(await admin.from('products').insert({name:`Teste isolado ${suffix}`,price_cents:100,category_id:category}).select().single())).id;
  await ok(await admin.from('product_variants').insert({product_id:product,size_id:size,color_id:color,sku:suffix,stock:1}));
  imagePath = `${product}/${crypto.randomUUID()}.png`;
  imageId = (await ok(await admin.from('product_images').insert({product_id:product,path:imagePath}).select().single())).id;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4ZkAAAAASUVORK5CYII=', 'base64');
  await ok(await admin.storage.from('catalog').upload(imagePath,png,{contentType:'image/png',cacheControl:'0'}));
  for (const client of [anon,user]) {
    assert.equal((await ok(await client.from('products').select('id').eq('id',product))).length,0);
    assert.ok((await client.from('products').insert({name:'Forbidden',price_cents:100})).error);
    assert.ok((await client.storage.from('catalog').upload(`${product}/${crypto.randomUUID()}.png`,png,{contentType:'image/png'})).error);
    assert.ok((await client.storage.from('catalog').download(imagePath)).error);
  }
  stage = 'publicacao';
  await ok(await admin.from('products').update({status:'active'}).eq('id',product));
  for (const client of [anon,user]) {
    assert.equal((await ok(await client.from('products').select('id').eq('id',product))).length,1);
    await ok(await client.storage.from('catalog').download(imagePath));
    const result = await client.from('products').update({name:'Forbidden'}).eq('id',product).select('id');
    assert.ok(result.error || result.data.length === 0);
    const deletion = await client.from('products').delete().eq('id',product).select('id');
    assert.ok(deletion.error || deletion.data.length === 0);
  }
  stage = 'arquivo';
  await ok(await admin.from('products').update({status:'archived'}).eq('id',product));
  for (const client of [anon,user]) {
    assert.equal((await ok(await client.from('products').select('id').eq('id',product))).length,0);
    assert.ok((await client.storage.from('catalog').download(imagePath)).error);
  }
  console.log('Supabase real: autenticação, cadastro, publicação, arquivamento, RLS e Storage verificados em staging.');
} catch {
  console.error(`Verificação falhou na etapa: ${stage}. Nenhum detalhe de credencial foi registrado.`); process.exitCode = 1;
} finally {
  async function clean(promise) { try { const result = await promise; if (result.error) cleanupFailed = true; } catch { cleanupFailed = true; } }
  if (imagePath) await clean(admin.storage.from('catalog').remove([imagePath]));
  if (imageId) await clean(admin.from('product_images').delete().eq('id',imageId));
  if (product) await clean(admin.from('products').delete().eq('id',product));
  for (const [table,id] of [['categories',category],['sizes',size],['colors',color]]) if (id) await clean(admin.from(table).delete().eq('id',id));
  await clean(admin.auth.signOut()); await clean(user.auth.signOut());
  if (cleanupFailed) { console.error('Limpeza incompleta. Confira registros Teste isolado e objetos órfãos no projeto de staging.'); process.exitCode = 1; }
}
