import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { testBanners } from './banners.mjs';

test('migrations and catalog permissions in isolated PostgreSQL (not hosted Supabase)', async () => {
  const db = new PGlite();
  try {
    // Minimal Supabase-owned schemas. HTTP Auth/Storage behavior is tested separately.
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, metadata jsonb);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select, insert, update, delete on storage.objects to anon, authenticated;`);
    for (const name of ['202609060001_catalog.sql', '202609060002_storage.sql', '202609090001_theme.sql', '202609160001_banners.sql']) await db.exec(await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8'));
    const bucket = (await db.query("select * from storage.buckets where id='catalog'")).rows[0];
    assert.equal(bucket.public,false);
    assert.equal(Number(bucket.file_size_limit),5242880);
    assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
    const admin = '00000000-0000-4000-8000-000000000001';
    const ordinary = '00000000-0000-4000-8000-000000000002';
    await db.query('insert into auth.users values ($1),($2)', [admin, ordinary]);
    await db.query('insert into private.admin_memberships(user_id) values ($1)', [admin]);
    async function role(name, user = '') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
      await db.exec(`set role ${name}`);
    }
    async function denied(sql, params = []) { await assert.rejects(db.query(sql, params), e => e.code === '42501'); }
    await role('authenticated', admin);
    assert.equal((await db.query('select public.is_admin() as ok')).rows[0].ok, true);
    const cat = (await db.query("insert into public.categories(name) values ('Isolated category') returning id")).rows[0].id;
    const size = (await db.query("insert into public.sizes(name) values ('Isolated size') returning id")).rows[0].id;
    const color = (await db.query("insert into public.colors(name,hex) values ('Isolated color','#123456') returning id")).rows[0].id;
    const product = (await db.query("insert into public.products(name,price_cents,category_id) values ('Isolated product',1000,$1) returning id", [cat])).rows[0].id;
    const variant = (await db.query("insert into public.product_variants(product_id,size_id,color_id,sku,stock) values ($1,$2,$3,'ISOLATED',2) returning id", [product,size,color])).rows[0].id;
    await assert.rejects(db.query('update public.product_variants set stock = -1 where id = $1', [variant]), e => e.code === '23514');
    const path = `${product}/00000000-0000-4000-8000-000000000003.png`;
    await db.query('insert into public.product_images(product_id,path) values ($1,$2)', [product,path]);
    await db.query("insert into storage.objects(bucket_id,name) values ('catalog',$1)", [path]);
    await denied('insert into private.admin_memberships(user_id) values ($1)', [ordinary]);
    const tables = ['products','categories','sizes','colors','product_variants','product_images'];
    for (const [name,user] of [['anon',''],['authenticated',ordinary]]) {
      await role(name,user);
      assert.equal((await db.query('select public.is_admin() as ok')).rows[0].ok, false);
      for (const table of tables) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0, `${name}: private ${table}`);
      assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
      await denied("insert into public.products(name,price_cents) values ('forbidden',100)");
      await denied("insert into public.categories(name) values ('forbidden')");
      await denied("insert into public.sizes(name) values ('forbidden')");
      await denied("insert into public.colors(name,hex) values ('forbidden','#123456')");
      await denied("insert into public.product_variants(product_id,size_id,color_id,sku) values ($1,$2,$3,'forbidden')",[product,size,color]);
      await denied('insert into public.product_images(product_id,path) values ($1,$2)',[product,`${product}/00000000-0000-4000-8000-000000000004.png`]);
      await denied("insert into storage.objects(bucket_id,name) values ('catalog',$1)",[path]);
      await denied('insert into private.admin_memberships(user_id) values ($1)',[ordinary]);
      await denied('select * from private.admin_memberships');
    }
    await role('authenticated',admin);
    await db.query("update public.products set status='active' where id=$1",[product]);
    for (const [name,user] of [['anon',''],['authenticated',ordinary]]) {
      await role(name,user);
      for (const table of tables) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 1, `${name}: published ${table}`);
      assert.equal((await db.query('select * from storage.objects')).rows.length,1);
      if (name === 'anon') {
        await denied("update public.products set name='forbidden' where id=$1",[product]);
        await denied('delete from public.products where id=$1',[product]);
      } else {
        for (const table of tables) {
          assert.equal((await db.query(`update public.${table} set id=id returning id`)).rows.length,0);
          assert.equal((await db.query(`delete from public.${table} returning id`)).rows.length,0);
        }
        // Editable claims do not grant membership.
        await db.query("select set_config('request.jwt.claims', $1, false)",[JSON.stringify({sub:ordinary,user_metadata:{role:'admin',is_admin:true}})]);
        assert.equal((await db.query('select public.is_admin() as ok')).rows[0].ok,false);
      }
      assert.equal((await db.query('delete from storage.objects returning id')).rows.length,0);
      assert.equal((await db.query('update storage.objects set name=name returning id')).rows.length,0);
    }
    await role('authenticated',admin);
    await db.query("update public.products set status='archived' where id=$1",[product]);
    await role('anon');
    for (const table of tables) assert.equal((await db.query(`select * from public.${table}`)).rows.length,0);
    assert.equal((await db.query('select * from storage.objects')).rows.length,0);
    await role('authenticated',admin);
    assert.equal((await db.query('select * from public.products')).rows.length,1);
    await db.exec('reset role');
    // Theme RPCs: real SQL privileges, validation, draft isolation and atomic publication.
    await role('authenticated', admin);
    const theme = { primary: '#325b4c', background: '#ffffff', text: '#191919', surface: '#f6f6f4' };
    const getEditor = async () => (await db.query('select public.get_theme_editor() as value')).rows[0].value;
    const saveTheme = async (tokens, revision, publish) => (await db.query('select public.save_theme($1::jsonb,$2::uuid,$3::boolean) as value', [JSON.stringify(tokens),revision,publish])).rows[0].value;
    let editor = await getEditor();
    assert.equal(editor.draft,null);
    assert.equal(editor.published,null);
    const initialRevision = editor.revision;
    editor = await saveTheme(theme,editor.revision,false);
    assert.deepEqual(editor.draft,theme);
    assert.equal(editor.published,null);
    await assert.rejects(saveTheme(theme,initialRevision,true), e=>e.code==='40001');
    await assert.rejects(saveTheme({...theme,primary:'red'},editor.revision,true), e=>e.code==='22023');
    await assert.rejects(saveTheme({...theme,extra:'#ffffff'},editor.revision,false), e=>e.code==='22023');
    await assert.rejects(saveTheme({...theme,text:null},editor.revision,false), e=>e.code==='22023');
    await assert.rejects(saveTheme({...theme,text:'#ffffff'},editor.revision,true), e=>e.code==='22023');
    assert.equal((await db.query('select * from public.theme_versions')).rows.length,0);
    await denied('update public.theme_settings set published = null');
    await denied('insert into public.theme_versions(tokens) values ($1::jsonb)',[JSON.stringify(theme)]);
    for (const [name,user] of [['anon',''],['authenticated',ordinary]]) {
      await role(name,user);
      assert.equal((await db.query('select published from public.theme_settings')).rows[0].published,null);
      await denied('select draft from public.theme_settings');
      await denied('select * from public.theme_settings');
      await denied('select public.get_theme_editor()');
      await denied('select public.save_theme($1::jsonb,$2::uuid,true)',[JSON.stringify(theme),editor.revision]);
      await denied('update public.theme_settings set published = null');
    }
    await role('authenticated',admin);
    editor = await saveTheme(theme,editor.revision,true);
    assert.deepEqual(editor.published,theme);
    const nextTheme = {...theme,primary:'#c08040'};
    editor = await saveTheme(nextTheme,editor.revision,false);
    assert.deepEqual(editor.published,theme);
    assert.equal((await db.query('select * from public.theme_versions')).rows.length,1);
    for (const [name,user] of [['anon',''],['authenticated',ordinary]]) {
      await role(name,user);
      assert.deepEqual((await db.query('select published from public.theme_settings')).rows[0].published,theme);
      if (name==='authenticated') assert.equal((await db.query('select * from public.theme_versions')).rows.length,0);
      else await denied('select * from public.theme_versions');
    }
    await role('authenticated',admin);
    editor = await saveTheme(nextTheme,editor.revision,true);
    assert.deepEqual(editor.published,nextTheme);
    assert.equal((await db.query('select * from public.theme_versions')).rows.length,2);
    await db.exec('reset role');
    await testBanners({ db, role, denied, admin, ordinary });
    await db.exec('reset role');
    await db.query('delete from private.admin_memberships where user_id=$1',[admin]);
    await role('authenticated',admin);
    assert.equal((await db.query('select public.is_admin() as ok')).rows[0].ok,false);
    await denied("select public.prepare_banner_upload('hero','png')");
    await denied('select public.claim_banner_cleanup()');
    await denied("insert into public.products(name,price_cents) values ('revoked',100)");
    await denied('select public.save_theme($1::jsonb,$2::uuid,true)',[JSON.stringify(theme),editor.revision]);
  } finally { await db.close(); }
});
