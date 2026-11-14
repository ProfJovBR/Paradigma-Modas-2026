import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('contact configuration: admin authorization, hidden data and concurrent updates (isolated PostgreSQL)', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; grant usage on schema public to anon, authenticated;
      create function public.is_admin() returns boolean language sql as $$ select current_setting('test.admin',true) = 'yes' $$;`);
    await db.exec(await readFile(new URL('../../supabase/migrations/20261114002500_contact_settings.sql', import.meta.url), 'utf8'));
    const role = async (name, admin = false) => { await db.exec('reset role'); await db.query("select set_config('test.admin',$1,false)", [admin ? 'yes' : 'no']); await db.exec(`set role ${name}`); };
    const get = async name => (await db.query(`select public.${name}() as value`)).rows[0].value;
    const save = async (settings, revision) => (await db.query('select public.save_contact_settings($1::jsonb,$2::uuid) as value',[JSON.stringify(settings),revision])).rows[0].value;
    await role('authenticated',true);
    let editor = await get('get_contact_editor');
    const original = editor.revision;
    const settings = { email:'contact@example.test', email_visible:true, whatsapp:'+5516999999999',whatsapp_visible:false,phone:'+551633333333',phone_visible:true };
    editor = await save(settings,editor.revision);
    await assert.rejects(save(settings,original), e => e.code === '40001');
    await assert.rejects(save({...settings,email:'a@example.test\r\nBcc:x@example.test'},editor.revision),e => e.code === '23514');
    await assert.rejects(save({...settings,whatsapp:'javascript:alert(1)'},editor.revision),e => e.code === '23514');
    await assert.rejects(save({...settings,phone:'',phone_visible:true},editor.revision),e => e.code === '23514');
    await assert.rejects(save({...settings,email_visible:'true'},editor.revision),e => e.code === '22023');
    for (const name of ['anon','authenticated']) {
      await role(name);
      const data = await get('get_public_contact');
      assert.equal(data.email,settings.email); assert.equal(data.whatsapp,''); assert.equal(data.phone,settings.phone);
      assert.equal(data.revision,undefined);
      await assert.rejects(get('get_contact_editor'),e => e.code === '42501');
      await assert.rejects(save(settings,editor.revision),e => e.code === '42501');
      if (name === 'anon') await assert.rejects(db.query('select * from public.contact_settings'),e => e.code === '42501');
      else assert.deepEqual((await db.query('select * from public.contact_settings')).rows,[]);
      await assert.rejects(db.query("update public.contact_settings set email='bad@example.test'"),e=>e.code==='42501');
    }
  } finally { await db.close(); }
});
