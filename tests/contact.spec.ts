import { test, expect } from '@playwright/test';
import { mockSupabase } from './mock-supabase';

test('admin saves channels, storefront shows only enabled channels and safely composes email', async ({page,context}) => {
  await mockSupabase(context);
  let saved = { email:'',email_visible:false,whatsapp:'',whatsapp_visible:false,phone:'',phone_visible:false,revision:crypto.randomUUID() };
  await context.route('**/rest/v1/rpc/*contact*', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/save_contact_settings')) {
      const body = route.request().postDataJSON();
      if (body.p_revision !== saved.revision) return route.fulfill({status:409,json:{code:'40001'}});
      saved = {...body.p_settings,revision:crypto.randomUUID()};
    }
    if (path.endsWith('/get_public_contact')) return route.fulfill({json:{...saved,email:saved.email_visible?saved.email:'',whatsapp:saved.whatsapp_visible?saved.whatsapp:'',phone:saved.phone_visible?saved.phone:''}});
    return route.fulfill({json:saved});
  });
  await page.goto('http://127.0.0.1:5184/#configuracoes');
  await page.getByLabel('E-mail', {exact:true}).fill('admin@example.test');
  await page.getByLabel('Senha', {exact:true}).fill('Example-123!');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByLabel('E-mail de atendimento',{exact:true}).fill('loja@example.test');
  await page.getByLabel('Exibir e-mail de atendimento na loja',{exact:true}).check();
  await page.getByLabel('WhatsApp',{exact:true}).fill('+5516999999999');
  await page.getByLabel('Exibir whatsapp na loja',{exact:true}).check();
  await page.getByLabel('Telefone',{exact:true}).fill('+551633333333');
  await page.getByRole('button',{name:'Salvar contatos',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Contatos salvos');
  await page.reload();
  await expect(page.getByLabel('E-mail de atendimento',{exact:true})).toHaveValue('loja@example.test');
  await page.setViewportSize({width:320,height:760});
  await page.goto('http://127.0.0.1:5183/#informacoes/Fale%20conosco');
  await expect(page.getByRole('heading',{name:'Vamos conversar?'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Conversar no WhatsApp'})).toHaveAttribute('href','https://wa.me/5516999999999');
  await expect(page.getByRole('heading',{name:'Telefone',exact:true})).toHaveCount(0);
  await page.getByLabel('Assunto',{exact:true}).fill('Troca & tamanho');
  await page.getByLabel('Mensagem',{exact:true}).fill('Olá!\nGostaria de trocar.');
  const mail = page.getByRole('link',{name:'Abrir mensagem no e-mail'});
  await expect(mail).toHaveAttribute('href','mailto:loja@example.test?subject=Troca%20%26%20tamanho&body=Ol%C3%A1!%0AGostaria%20de%20trocar.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});

test('contact has honest empty and network failure states',async({page,context})=>{
  await mockSupabase(context);
  let fail = false;
  await context.route('**/rest/v1/rpc/get_public_contact',route => fail ? route.fulfill({status:503,json:{message:'offline'}}) : route.fulfill({json:{email:'',email_visible:false,whatsapp:'',whatsapp_visible:false,phone:'',phone_visible:false}}));
  await page.goto('http://127.0.0.1:5183/#informacoes/Fale%20conosco');
  await expect(page.getByText('Os canais de atendimento ainda não estão disponíveis. Volte em breve.')).toBeVisible();
  fail = true; await page.reload();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  fail = false; await page.getByRole('button',{name:'Tentar novamente'}).click();
  await expect(page.getByText('Os canais de atendimento ainda não estão disponíveis. Volte em breve.')).toBeVisible();
});
