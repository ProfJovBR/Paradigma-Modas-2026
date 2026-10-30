import { test, expect } from '@playwright/test';
import { mockSupabase } from './mock-supabase';
for (const width of [1440, 320]) test(`checkout retries lost response without duplicating, ${width}px`, async ({page,context},testInfo)=>{
 const mock=await mockSupabase(context);const product=crypto.randomUUID(),variant=crypto.randomUUID();
 mock.tables.products.push({id:product,name:'TESTE ISOLADO',status:'active',price_cents:2500,description:'Fixture',created_at:new Date().toISOString()});
 mock.tables.product_variants.push({id:variant,product_id:product,sku:'TESTE',stock:5});
 let requests:any[]=[];let attempts=0;
 await context.route('**/rest/v1/rpc/submit_order',async route=>{requests.push(route.request().postDataJSON());attempts++;if(attempts===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'lost response'})});return route.fulfill({contentType:'application/json',body:JSON.stringify({number:42,subtotal_cents:5000})});});
 await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:5183');
 await page.evaluate(({product,variant})=>sessionStorage.setItem('paradigma-basket',JSON.stringify({items:[{productId:product,variantId:variant,quantity:2}],favorites:[]})),{product,variant});
 await page.goto('http://127.0.0.1:5183/#checkout');await page.reload();
 await page.getByLabel('Nome completo').fill('Cliente Teste');await page.getByLabel('E-mail',{exact:true}).fill('teste@example.test');await page.getByLabel('Telefone / WhatsApp').fill('16999999999');
 await page.getByLabel('Modalidade').selectOption('delivery');await page.getByLabel('CEP',{exact:true}).fill('14620-000');await page.getByLabel('Endereço',{exact:true}).fill('Rua Teste');await page.getByLabel('Número',{exact:true}).fill('1');await page.getByLabel('Bairro',{exact:true}).fill('Centro');await page.getByLabel('Cidade',{exact:true}).fill('Orlândia');await page.getByLabel('Estado',{exact:true}).selectOption('SP');
 await page.getByRole('checkbox').check();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('checkout.png'),fullPage:true});
 await page.getByRole('button',{name:'CONFIRMAR PEDIDO'}).click();await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar');
 await page.reload();await page.getByRole('button',{name:'Verificar envio / tentar novamente'}).click();await expect(page.getByRole('heading',{name:'Pedido enviado!'})).toBeVisible();expect(requests[0]).toEqual(requests[1]);expect(requests[0].p_delivery.address.cep).toBe('14620000');
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('paradigma-basket')!).items)).toEqual([]);
});
test('empty checkout cannot submit',async({page,context})=>{await mockSupabase(context);await page.goto('http://127.0.0.1:5183/#checkout');await expect(page.getByRole('button',{name:'CONFIRMAR PEDIDO'})).toBeDisabled();});
