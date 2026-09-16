import { test, expect } from '@playwright/test';
import { mockSupabase } from './mock-supabase';

test('size and color presets persist without replacing existing attributes', async ({ page, context }) => {
  const mock = await mockSupabase(context);
  mock.tables.sizes.push({ id: 'existing-m', name: 'm' });
  mock.tables.colors.push({ id: 'existing-black', name: 'Preto', hex: '#111111' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('http://127.0.0.1:5184');
  await page.getByLabel('E-mail').fill('admin@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('link', { name: 'Categorias e variações' }).click();
  await expect(page.getByRole('button', { name: 'Cadastrar opções padrão' })).toHaveCount(0);
  for (const [tab, table, total] of [['Tamanhos', 'sizes', 20], ['Cores', 'colors', 18]] as const) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.getByRole('button', { name: 'Cadastrar opções padrão' }).click();
    await expect(page.getByRole('status')).toContainText('Opções padrão cadastradas');
    expect(mock.tables[table]).toHaveLength(total);
    await expect(page.getByRole('button', { name: 'Opções padrão já cadastradas' })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Categorias', exact: true }).click();
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Opções padrão já cadastradas' })).toBeDisabled();
  }
  expect(mock.tables.sizes.find(row => row.id === 'existing-m')?.name).toBe('m');
  expect(mock.tables.colors.find(row => row.id === 'existing-black')?.hex).toBe('#111111');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Excluir Rosa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cadastrar opções padrão' })).toBeEnabled();
  await page.route('https://supabase.test/rest/v1/colors**', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'permission denied' }) });
    await route.fallback();
  });
  await page.getByRole('button', { name: 'Cadastrar opções padrão' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Opções padrão cadastradas.', { exact: false })).toHaveCount(0);
  expect(mock.tables.colors).toHaveLength(17);
});
