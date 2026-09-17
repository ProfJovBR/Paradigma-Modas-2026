import { test, expect, type Page, type Locator } from '@playwright/test';
import { mockSupabase } from './mock-supabase';

async function login(page: Page) {
  await page.goto('http://127.0.0.1:5184/#banners');
  await page.getByLabel('E-mail').fill('admin@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Banners', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Hero Banner' }).getByLabel('Nova imagem')).toBeEnabled();
}
async function imageFile(page: Page, mimeType = 'image/png') {
  // Synthetic pixels in memory, never production/catalog content.
  const bytes = await page.evaluate(async type => {
    const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 960;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#4682b4'; ctx.fillRect(0, 0, 1440, 960);
    ctx.fillStyle = '#fafafa'; ctx.fillRect(600, 200, 200, 600);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), type));
    return [...new Uint8Array(await blob.arrayBuffer())];
  }, mimeType);
  return { name: `banner.${mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1]}`, mimeType, buffer: Buffer.from(bytes) };
}
async function publish(card: Locator) {
  await card.getByRole('button', { name: 'Salvar e publicar' }).click();
  await expect(card.getByLabel('Nova imagem')).toBeEnabled();
  await expect(card.getByRole('status')).toContainText('Banner publicado.');
}
async function refresh(page: Page) { await page.evaluate(() => window.dispatchEvent(new Event('focus'))); }

for (const width of [1440, 768, 390, 320]) {
  test(`banner publication, preview, cancel, removal and responsive layout at ${width}px`, async ({ page, context }, info) => {
    const mock = await mockSupabase(context);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    const hero = page.getByRole('region', { name: 'Hero Banner' });
    const cta = page.getByRole('region', { name: 'CTA Banner' });
    const file = await imageFile(page, width === 768 ? 'image/jpeg' : width === 390 ? 'image/webp' : 'image/png');
    await expect(hero.getByTestId('hero-published').locator('svg')).toBeVisible();
    await hero.getByLabel('Nova imagem').setInputFiles(file);
    await hero.getByLabel('Texto alternativo').fill('Imagem de teste do hero');
    await expect(hero.getByTestId('hero-preview').getByRole('img')).toBeVisible();
    expect(mock.files.size).toBe(0);
    await hero.getByRole('button', { name: 'Cancelar alterações' }).click();
    await expect(hero.getByTestId('hero-preview')).toHaveCount(0);
    await expect(hero.getByLabel('Texto alternativo')).toHaveValue('');
    await hero.getByLabel('Nova imagem').setInputFiles(file);
    await hero.getByLabel('Texto alternativo').fill('Imagem de teste do hero');
    const store = await context.newPage(); await store.setViewportSize({ width, height: 1000 });
    await store.goto('http://127.0.0.1:5183');
    const before = await store.locator('.campaign-hero').boundingBox();
    await publish(hero);
    expect(mock.files.size).toBe(1);
    await refresh(store);
    await expect(store.locator('.campaign-hero img')).toHaveAttribute('alt', 'Imagem de teste do hero');
    await expect(store.locator('.campaign-hero img')).toHaveCSS('object-fit', 'cover');
    const after = await store.locator('.campaign-hero').boundingBox();
    expect(after?.height).toBe(before?.height); expect(after?.width).toBe(before?.width);
    await cta.getByLabel('Nova imagem').setInputFiles(file);
    await cta.getByLabel('Texto alternativo').fill('Imagem de teste do CTA');
    await publish(cta);
    await refresh(store);
    await expect(store.locator('.campaign-banner img')).toHaveAttribute('alt', 'Imagem de teste do CTA');
    await expect(store.locator('.campaign-banner img')).toHaveCSS('object-fit', 'cover');
    await cta.getByLabel('Texto alternativo').fill('Texto alternativo atualizado');
    await publish(cta);
    expect(mock.files.size).toBe(2);
    await refresh(store);
    await expect(store.locator('.campaign-banner img')).toHaveAttribute('alt', 'Texto alternativo atualizado');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await store.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 320) {
      await page.screenshot({ path: info.outputPath('banners-admin.png'), fullPage: true });
      await store.screenshot({ path: info.outputPath('banners-store.png'), fullPage: true });
    }
    await hero.getByRole('button', { name: 'Remover imagem', exact: true }).click();
    await expect(hero.getByTestId('hero-preview').locator('svg')).toBeVisible();
    await hero.getByRole('button', { name: 'Cancelar alterações' }).click();
    await expect(hero.getByTestId('hero-published').getByRole('img')).toHaveAttribute('alt', 'Imagem de teste do hero');
    await hero.getByRole('button', { name: 'Remover imagem', exact: true }).click();
    await publish(hero);
    await refresh(store);
    await expect(store.locator('.campaign-hero img')).toHaveCount(0);
    await expect(store.locator('.campaign-hero > .reference-photo svg')).toBeVisible();
    expect(mock.files.size).toBe(1);
    expect(mock.tables.site_banners.find(b => b.slot === 'hero')?.path).toBeNull();
    await page.reload();
    await expect(cta.getByLabel('Texto alternativo')).toHaveValue('Texto alternativo atualizado');
    expect(errors).toEqual([]);
  });
}

test('banner validation, failed uploads/publication and safe cleanup after a lost response', async ({ page, context }) => {
  const mock = await mockSupabase(context); await login(page);
  const hero = page.getByRole('region', { name: 'Hero Banner' });
  const input = hero.getByLabel('Nova imagem');
  await input.setInputFiles({ name: 'bad.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await expect(hero.getByRole('alert')).toContainText('JPEG, PNG ou WebP');
  await input.setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(5_000_001) });
  await expect(hero.getByRole('alert')).toContainText('5.000.000');
  await input.setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not png') });
  await expect(hero.getByRole('alert')).toContainText('não corresponde');
  await input.setInputFiles({ name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from([137,80,78,71,13,10,26,10]) });
  await expect(hero.getByRole('alert')).toContainText('corrompida');
  const file = await imageFile(page);
  await input.setInputFiles(file); await hero.getByLabel('Texto alternativo').fill('Original'); await publish(hero);
  const oldPath = mock.tables.site_banners[0].path;
  mock.state.failBannerUpload = true;
  await input.setInputFiles(file);
  await hero.getByRole('button', { name: 'Salvar e publicar' }).click();
  await expect(hero.getByRole('alert')).toContainText('publicado não foi alterado');
  expect(mock.tables.site_banners[0].path).toBe(oldPath); expect(mock.files.size).toBe(1);
  mock.state.failBannerUpload = false; mock.state.failBannerSave = true;
  await hero.getByRole('button', { name: 'Salvar e publicar' }).click();
  await expect(hero.getByRole('alert')).toContainText('Não foi possível confirmar');
  await expect(hero.getByRole('button', { name: 'Salvar e publicar' })).toBeDisabled();
  expect(mock.tables.site_banners[0].path).toBe(oldPath); expect(mock.files.size).toBe(1);
  mock.state.failBannerSave = false;
  page.on('dialog', dialog => dialog.accept());
  await hero.getByRole('button', { name: 'Recarregar banner publicado' }).click();
  await expect(input).toBeEnabled();
  mock.state.loseBannerResponse = true;
  await input.setInputFiles(file); await hero.getByLabel('Texto alternativo').fill('Publicado com resposta perdida');
  await hero.getByRole('button', { name: 'Salvar e publicar' }).click();
  await expect(hero.getByRole('alert')).toContainText('Não foi possível confirmar');
  const newPath = mock.tables.site_banners[0].path;
  expect(newPath).not.toBe(oldPath); expect(mock.files.has(newPath)).toBe(true);
  expect(mock.bannerAssets.get(newPath)?.state).toBe('active');
  await hero.getByRole('button', { name: 'Recarregar banner publicado' }).click();
  await expect(hero.getByLabel('Texto alternativo')).toHaveValue('Publicado com resposta perdida');
  mock.state.failBannerCleanup = true;
  await input.setInputFiles(file); await publish(hero);
  await expect(page.getByText('A limpeza de arquivos antigos não foi concluída.', { exact: false })).toBeVisible();
  expect(mock.files.size).toBe(2);
  mock.state.failBannerCleanup = false;
  await page.getByRole('button', { name: 'Tentar limpeza novamente' }).click();
  await expect(page.getByRole('button', { name: 'Tentar limpeza novamente' })).toHaveCount(0);
  expect(mock.files.size).toBe(1);
});

test('banner conflict, unavailable migration, store fallback and access gate', async ({ page, context }) => {
  const mock = await mockSupabase(context); await login(page);
  const hero = page.getByRole('region', { name: 'Hero Banner' });
  const file = await imageFile(page);
  await hero.getByLabel('Nova imagem').setInputFiles(file);
  await hero.getByLabel('Texto alternativo').fill('Publicado'); await publish(hero);
  mock.tables.site_banners[0].revision = crypto.randomUUID();
  await hero.getByLabel('Texto alternativo').fill('Conflito');
  await hero.getByRole('button', { name: 'Salvar e publicar' }).click();
  await expect(hero.getByRole('alert')).toContainText('outra aba');
  expect(mock.tables.site_banners[0].alt).toBe('Publicado');
  mock.state.failBannerDownload = true;
  const store = await context.newPage(); await store.goto('http://127.0.0.1:5183');
  await expect(store.locator('.campaign-hero img')).toHaveCount(0);
  await expect(store.locator('.campaign-hero > .reference-photo svg')).toBeVisible();
  mock.state.failBannerDownload = false; await refresh(store);
  await expect(store.locator('.campaign-hero img')).toHaveAttribute('alt', 'Publicado');
  mock.state.failBannerLoad = true; await refresh(store);
  await expect(store.locator('.campaign-hero img')).toHaveCount(0);
  // A reload deliberately discards the local draft for this missing-migration check.
  page.on('dialog', dialog => dialog.accept()); await page.reload();
  await expect(hero.getByRole('alert')).toContainText('migration');
  await expect(hero.getByRole('button', { name: 'Salvar e publicar' })).toBeDisabled();
  mock.state.failBannerLoad = false;
  await hero.getByRole('button', { name: 'Recarregar banner publicado' }).click();
  await expect(hero.getByLabel('Nova imagem')).toBeEnabled();
  mock.state.email = 'common@example.test';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('alert')).toContainText('não tem permissão administrativa');
  await expect(page.getByRole('region', { name: 'Hero Banner' })).toHaveCount(0);
});
