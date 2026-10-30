import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
test('guest order privacy, server pricing, idempotency, stock lifecycle and limits', async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;`);
 for(const f of ['202609060001_catalog.sql','20261030142018_checkout_orders.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const admin=randomUUID(),customer=randomUUID();await db.query('insert into auth.users values ($1),($2)',[admin,customer]);await db.query('insert into private.admin_memberships(user_id) values ($1)',[admin]);
 const size=(await db.query("insert into sizes(name) values ('TEST') returning id")).rows[0].id;
 const color=(await db.query("insert into colors(name,hex) values ('TEST','#123456') returning id")).rows[0].id;
 const product=(await db.query("insert into products(name,price_cents,status) values ('ISOLATED TEST',12590,'active') returning id")).rows[0].id;
 const variant=(await db.query("insert into product_variants(product_id,size_id,color_id,sku,stock) values($1,$2,$3,'TEST',3) returning id",[product,size,color])).rows[0].id;
 async function role(r,user=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role '+r);}
 const person={name:'Teste Local',email:'teste@example.test',phone:'16999999999'};
 async function submit(key=randomUUID(),total=25180,items=[{variant_id:variant,quantity:2}],delivery={method:'pickup'}){return(await db.query('select submit_order($1,$2,$3,$4,$5,$6) as receipt',[key,JSON.stringify(person),JSON.stringify(delivery),JSON.stringify(items),total,'Teste local'])).rows[0].receipt;}
 await role('anon');
 await assert.rejects(submit(randomUUID(),1),/PRICE_CHANGED/);
 await assert.rejects(submit(randomUUID(),25180,[{variant_id:variant,quantity:4}]),/STOCK_UNAVAILABLE/);
 await assert.rejects(submit(randomUUID(),25180,[{variant_id:variant,quantity:1},{variant_id:variant,quantity:1}]),/INVALID_ITEMS/);
 await assert.rejects(submit(randomUUID(),25180,[],{method:'pickup'}),/INVALID_ORDER/);
 await assert.rejects(submit(randomUUID(),25180,undefined,{method:'delivery',address:{}}),/INVALID_ADDRESS/);
 const key=randomUUID(),receipt=await submit(key);assert.equal(receipt.subtotal_cents,25180);assert.deepEqual(await submit(key),receipt);
 await assert.rejects(submit(key,12590,[{variant_id:variant,quantity:1}]),/REQUEST_CONFLICT/);
 await assert.rejects(db.query('select * from orders'),e=>e.code==='42501');await assert.rejects(db.query('select * from order_items'),e=>e.code==='42501');
 await assert.rejects(db.query("insert into orders(customer_name) values('bad')"),e=>e.code==='42501');
 await role('authenticated',customer);assert.equal((await db.query('select * from orders')).rows.length,0);
 await assert.rejects(db.query("select set_order_status($1,$2,'confirmed')",[randomUUID(),randomUUID()]),e=>e.code==='42501');
 await role('authenticated',admin);let order=(await db.query('select * from orders')).rows[0];assert.equal((await db.query('select stock from product_variants')).rows[0].stock,3);
 let result=(await db.query("select set_order_status($1,$2,'confirmed') as result",[order.id,order.revision])).rows[0].result;
 assert.equal((await db.query('select stock from product_variants')).rows[0].stock,1);
 await assert.rejects(db.query("select set_order_status($1,$2,'cancelled')",[order.id,order.revision]),e=>e.code==='40001');
 result=(await db.query("select set_order_status($1,$2,'cancelled') as result",[order.id,result.revision])).rows[0].result;
 assert.equal((await db.query('select stock from product_variants')).rows[0].stock,3);
 await assert.rejects(db.query("select set_order_status($1,$2,'confirmed')",[order.id,result.revision]),/INVALID_TRANSITION/);
 await role('anon');await submit();await submit();await assert.rejects(submit(),/RATE_LIMIT/);
 assert.deepEqual(await submit(key),receipt);
 }finally{await db.close();}
});
