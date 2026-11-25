import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
test('customer orders and recent views are isolated and statuses reflect admin updates',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;`);
 for(const f of ['202609060001_catalog.sql','20261030142018_checkout_orders.sql','20261031004332_customer_account_history.sql']) await db.exec(await readFile(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const a=randomUUID(),b=randomUUID(),admin=randomUUID();await db.query('insert into auth.users values($1),($2),($3)',[a,b,admin]);await db.query('insert into private.admin_memberships(user_id) values($1)',[admin]);
 const size=(await db.query("insert into sizes(name) values('M') returning id")).rows[0].id;
 const color=(await db.query("insert into colors(name,hex) values('Preto','#000000') returning id")).rows[0].id;
 const product=(await db.query("insert into products(name,price_cents,status) values('Teste',5000,'active') returning id")).rows[0].id;
 const variant=(await db.query("insert into product_variants(product_id,size_id,color_id,sku,stock) values($1,$2,$3,'TEST',10) returning id",[product,size,color])).rows[0].id;
 async function role(r,user=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role '+r);}
 const args=[randomUUID(),JSON.stringify({name:'Cliente Teste',email:'same@example.test',phone:'16999999999'}),JSON.stringify({method:'pickup'}),JSON.stringify([{variant_id:variant,quantity:1}]),5000,''];
 await role('authenticated',a);await db.query('select submit_order($1,$2,$3,$4,$5,$6)',args);
 let order=(await db.query('select * from orders')).rows[0];assert.equal(order.customer_id,a);assert.equal((await db.query('select * from order_items')).rows.length,1);
 await db.query('select record_product_view($1)',[product]);await db.query('select record_product_view($1)',[product]);assert.equal((await db.query('select * from product_views')).rows.length,1);
 await assert.rejects(db.query('insert into product_views(user_id,product_id) values($1,$2)',[b,product]),e=>e.code==='42501');
 await assert.rejects(db.query("update orders set status='completed'"),e=>e.code==='42501');
 await role('authenticated',b);assert.equal((await db.query('select * from orders')).rows.length,0);assert.equal((await db.query('select * from order_items')).rows.length,0);assert.equal((await db.query('select * from product_views')).rows.length,0);
 await db.query('select submit_order($1,$2,$3,$4,$5,$6)',args);assert.equal((await db.query('select * from orders')).rows.length,0,'retry cannot claim someone else order');
 await db.query('select submit_order($1,$2,$3,$4,$5,$6)',[randomUUID(),...args.slice(1)]);assert.equal((await db.query('select * from orders')).rows.length,1,'same email does not grant ownership');
 await role('authenticated',admin);await db.query("select set_order_status($1,$2,'confirmed')",[order.id,order.revision]);
 await role('authenticated',a);assert.equal((await db.query('select status from orders')).rows[0].status,'confirmed');
 await role('anon');await assert.rejects(db.query('select * from product_views'),e=>e.code==='42501');await assert.rejects(db.query('select record_product_view($1)',[product]),e=>e.code==='42501');
 await db.exec('reset role');await db.query("update product_views set viewed_at=now()-interval '31 days'");
 await role('authenticated',a);assert.equal((await db.query("select * from product_views where viewed_at>=now()-interval '30 days'")).rows.length,0);await db.query('select record_product_view($1)',[product]);assert.equal((await db.query("select * from product_views where viewed_at>=now()-interval '30 days'")).rows.length,1);
 }finally{await db.close();}
});
