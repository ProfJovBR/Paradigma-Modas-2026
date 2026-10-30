import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { mockSupabase } from './mock-supabase';

for (const width of [1440, 768, 390, 320]) {
  test(`reference routes, interactions and responsive layouts at ${width}px`, async ({ page, context }) => {
    test.setTimeout(120000);
    const mock = await mockSupabase(context);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    mock.tables.categories.push({ id: 'category-test', name: 'Feminino' });
    mock.tables.sizes.push({ id: 'size-test', name: 'M' });
    mock.tables.colors.push({ id: 'color-test', name: 'Bege', hex: '#d9c3a5' });
    for (let i = 1; i <= 8; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      mock.tables.products.push({ id, name: `Peça de teste ${String(i).padStart(2, '0')}`, description: 'Descrição isolada para validar o layout. Este produto não existe na aplicação padrão.', price_cents: 12000 + i * 990, category_id: 'category-test', status: 'active', created_at: '2026-09-09', updated_at: '2026-09-09' });
      mock.tables.product_variants.push({ id: `variant-${i}`, product_id: id, color_id: 'color-test', size_id: 'size-test', sku: `TEST-${i}`, stock: 5 });
      const path = `${id}/test.png`;
      mock.tables.product_images.push({ id: `image-${i}`, product_id: id, path, alt: `Foto de teste ${i}`, position: 0 });
      mock.files.set(path, await readFile(`tests/fixtures/photo-${(i - 1) % 4 + 1}.png`));
    }
    await page.setViewportSize({ width, height: 1000 });
    const out = `.local/design-review/${width}`;
    if (width === 1440 || width === 390) await mkdir(out, { recursive: true });
    async function capture(name: string) {
      await expect(page.locator('.skeleton-block')).toHaveCount(0);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; }))); });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow on ${name}`).toBe(true);
      if (width === 1440 || width === 390) await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, animations: 'disabled' });
    }
    await page.goto('http://127.0.0.1:5183');
    await expect(page.getByRole('heading', { name: 'Peça de teste 01' })).toBeVisible();
    await capture('01-home');
    await page.goto('http://127.0.0.1:5183/#catalogo');
    await expect(page.getByRole('heading', { name: 'Peça de teste 08' })).toBeVisible();
    await capture('02-catalogo');
    if (width <= 760) {
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible();
      await page.getByRole('dialog').getByLabel('Categoria', { exact: true }).selectOption('category-test');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.goto('http://127.0.0.1:5183/#produto/00000000-0000-4000-8000-000000000001');
    await page.getByRole('combobox', { name: 'Tamanho e cor' }).selectOption('variant-1');
    await capture('03-produto');
    await page.getByRole('button', { name: 'ADICIONAR AO CARRINHO', exact: true }).click();
    await expect(page.locator('.product-info').getByRole('status')).toContainText('Peça adicionada ao carrinho');
    await page.goto('http://127.0.0.1:5183/#carrinho');
    await expect(page.locator('.cart-product')).toContainText('Peça de teste 01');
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
    await expect(page.getByRole('spinbutton', { name: 'Quantidade', exact: true })).toHaveValue('2');
    await capture('04-carrinho');
    await page.reload();
    await expect(page.getByRole('spinbutton', { name: 'Quantidade', exact: true })).toHaveValue('2');
    await page.goto('http://127.0.0.1:5183/#checkout');
    await expect(page.getByRole('button', { name: 'CONFIRMAR PEDIDO' })).toBeEnabled();
    await expect(page.locator('.summary-product')).toContainText('Peça de teste 01');
    await capture('05-checkout');
    await page.goto('http://127.0.0.1:5184');
    await page.getByLabel('E-mail').fill('admin@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('test-only-password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Vendas nos últimos 30 dias' })).toBeVisible();
    await expect(page.locator('.stat').first()).toContainText('8');
    await capture('06-dashboard');
    await page.goto('http://127.0.0.1:5184/#produtos');
    await expect(page.locator('.product-admin-row')).toHaveCount(8);
    await capture('07-admin-produtos');
    await page.goto('http://127.0.0.1:5184/#promocoes');
    await capture('08-promocoes');
    await page.goto('http://127.0.0.1:5184/#promocoes/nova');
    await page.getByLabel('Nome da promoção').fill('Prévia de teste');
    await page.getByLabel('Data de início').fill('2026-09-10');
    await page.getByLabel('Data de término').fill('2026-09-30');
    await page.getByRole('checkbox').first().check();
    await page.getByRole('checkbox').nth(1).check();
    await page.getByLabel('Percentual para os produtos selecionados').fill('20');
    await expect(page.getByRole('button', { name: 'Salvar promoção', exact: true })).toBeDisabled();
    await capture('09-nova-promocao');
    await page.getByRole('button', { name: 'Desconto por item', exact: false }).click();
    await page.getByLabel('Desconto de Peça de teste 01').fill('10');
    await page.getByRole('button', { name: 'Visualizar prévia' }).click();
    await expect(page.getByRole('status')).toContainText('Nenhum preço foi alterado');
    await page.goto('http://127.0.0.1:5184/#aparencia');
    await expect(page.getByRole('button', { name: 'Publicar tema' })).toBeEnabled();
    await capture('10-aparencia');
    expect(errors).toEqual([]);
  });
}

test('new store routes stay empty without invented products', async ({ page, context }) => {
  await mockSupabase(context);
  await page.goto('http://127.0.0.1:5183');
  await expect(page.getByRole('heading', { name: 'Novas peças a caminho' })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(0);
  await page.goto('http://127.0.0.1:5183/#carrinho');
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible();
  await expect(page.locator('.cart-item')).toHaveCount(0);
  await page.goto('http://127.0.0.1:5183/#checkout');
  await expect(page.getByRole('button', { name: 'CONFIRMAR PEDIDO' })).toBeDisabled();
  await expect(page.locator('.summary-product')).toHaveCount(0);
});
