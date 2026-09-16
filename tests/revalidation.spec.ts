import { test, expect } from '@playwright/test';
import { mockSupabase } from './mock-supabase';

test('admin keeps unsaved edits during revalidation and blocks revoked access', async ({ page, context }) => {
  const mock = await mockSupabase(context);
  await page.goto('http://127.0.0.1:5184/#produtos');
  await page.getByLabel('E-mail').fill('admin@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Novo produto', exact: true }).click();
  const name = page.getByLabel('Nome', { exact: true });
  await name.fill('Edição ainda não salva');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://supabase.test/rest/v1/rpc/is_admin', async route => {
    await pending;
    await route.fallback();
  });
  const request = page.waitForRequest('**/rpc/is_admin');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await request;
  await expect(name).toHaveValue('Edição ainda não salva');
  await expect(page.getByText('Verificando sessão e permissões…')).toHaveCount(0);
  const response = page.waitForResponse('**/rpc/is_admin');
  release();
  await response;
  await expect(name).toHaveValue('Edição ainda não salva');
  mock.state.email = 'common@example.test';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('alert')).toContainText('Sua conta não tem permissão');
  await expect(name).toHaveCount(0);
});

test('store preserves catalog and product DOM during focus refresh and applies new data', async ({ page, context }) => {
  const mock = await mockSupabase(context);
  const id = '00000000-0000-4000-8000-000000000010';
  mock.tables.products.push({ id, name: 'Peça de teste', description: '', status: 'active', price_cents: 1000 });
  mock.tables.product_variants.push({ id: 'variant-test', product_id: id, stock: 2 });
  await page.goto('http://127.0.0.1:5183');
  await expect(page.getByRole('heading', { name: 'Peça de teste' })).toBeVisible();
  for (const detail of [false, true]) {
    if (detail) {
      await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Peça de teste' }) }).click();
      await page.getByRole('combobox', { name: 'Tamanho e cor' }).selectOption('variant-test');
    }
    const selector = detail ? '.product-detail' : '.catalog-grid';
    await page.locator(selector).evaluate(el => el.setAttribute('data-preserved', 'yes'));
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route('https://supabase.test/rest/v1/products?**', async route => {
      await pending;
      await route.fallback();
    });
    const request = page.waitForRequest('**/rest/v1/products?**');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await request;
    await expect(page.locator(selector)).toHaveAttribute('data-preserved', 'yes');
    await expect(page.getByText(detail ? 'Carregando produto…' : 'Carregando catálogo…')).toHaveCount(0);
    mock.tables.products[0].price_cents = detail ? 3000 : 2000;
    const response = page.waitForResponse('**/rest/v1/products?**');
    release();
    await response;
    await expect(page.getByText(detail ? /30,00/ : /20,00/)).toBeVisible();
    await expect(page.locator(selector)).toHaveAttribute('data-preserved', 'yes');
    if (detail) await expect(page.getByRole('combobox', { name: 'Tamanho e cor' })).toHaveValue('variant-test');
    await page.unroute('https://supabase.test/rest/v1/products?**');
  }
  mock.tables.products[0].status = 'archived';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Produto indisponível' })).toBeVisible();
});
