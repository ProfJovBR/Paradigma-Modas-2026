import { test, expect } from '@playwright/test';
import { mockSupabase } from './mock-supabase';

test('customer login persists, account button opens account, and logout clears it', async ({ page, context }) => {
  await mockSupabase(context);
  await page.goto('http://127.0.0.1:5183');
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByLabel('E-mail', { exact: true }).fill('customer@example.test');
  await modal.getByLabel('Senha', { exact: true }).fill('Example-123!');
  await modal.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page).toHaveURL(/#conta$/);
  await expect(page.getByText('customer@example.test', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('customer@example.test', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Explorar coleção', exact: true }).click();
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
  await expect(page).toHaveURL(/#conta$/);
  await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
  await expect(modal).toBeVisible();
});

test('signup checks confirmation and waits for email when no session is returned', async ({ page, context }) => {
  await mockSupabase(context);
  let payload: any;
  await context.route('**/auth/v1/signup**', route => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { id: '00000000-0000-4000-8000-000000000002', email: payload.email, identities: [] } });
  });
  await page.goto('http://127.0.0.1:5183/#conta');
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await modal.getByLabel('Nome', { exact: true }).fill('Cliente Teste');
  await modal.getByLabel('E-mail', { exact: true }).fill('customer@example.test');
  await modal.getByLabel('Senha', { exact: true }).fill('Example-123!');
  await modal.getByLabel('Confirmar senha', { exact: true }).fill('Different123!');
  await modal.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(modal.getByRole('alert')).toContainText('As senhas não coincidem');
  expect(payload).toBeUndefined();
  await modal.getByLabel('Confirmar senha', { exact: true }).fill('Example-123!');
  await modal.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(modal.getByRole('status')).toContainText('Confira seu e-mail');
  expect(payload.data).toEqual({ full_name: 'Cliente Teste' });
  expect(payload.data.role).toBeUndefined();
  await modal.getByRole('button', { name: 'Voltar para entrar' }).click();
  await expect(modal.getByLabel('Senha', { exact: true })).toHaveValue('');
});

test('failed login stays in dialog; Escape restores focus on mobile', async ({ page, context }) => {
  const { state } = await mockSupabase(context); state.denyLogin = true;
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('http://127.0.0.1:5183');
  const trigger = page.getByRole('button', { name: 'Minha conta', exact: true });
  await trigger.click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('E-mail', { exact: true }).fill('customer@example.test');
  await modal.getByLabel('Senha', { exact: true }).fill('Wrong123!');
  await modal.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(modal.getByRole('alert')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
