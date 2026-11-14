import type { SupabaseClient } from '@supabase/supabase-js';

export type ContactSettings = {
  email: string; email_visible: boolean;
  whatsapp: string; whatsapp_visible: boolean;
  phone: string; phone_visible: boolean;
};
export const emptyContact: ContactSettings = {
  email: '', email_visible: false, whatsapp: '', whatsapp_visible: false, phone: '', phone_visible: false,
};
export function contactError(value: ContactSettings): string | null {
  if (value.email && (value.email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value.email))) return 'Informe um e-mail válido.';
  for (const field of ['whatsapp', 'phone'] as const) {
    if (value[field] && !/^\+[1-9][0-9]{7,14}$/.test(value[field])) return 'Informe os números com +, código do país e DDD, sem espaços. Exemplo: +5516999999999.';
    if (value[`${field}_visible`] && !value[field]) return 'Preencha o número antes de exibir o canal.';
  }
  if (value.email_visible && !value.email) return 'Preencha o e-mail antes de exibir o canal.';
  return null;
}
export function isContactSettings(value: unknown): value is ContactSettings {
  if (!value || typeof value !== 'object') return false;
  const c = value as ContactSettings;
  return ['email', 'whatsapp', 'phone'].every(key => typeof c[key as keyof ContactSettings] === 'string' && typeof c[`${key}_visible` as keyof ContactSettings] === 'boolean') && !contactError(c);
}
export async function loadPublicContact(client: SupabaseClient | null) {
  if (!client) throw new Error('Contato indisponível.');
  const { data, error } = await client.rpc('get_public_contact');
  if (error) throw error;
  if (!isContactSettings(data)) throw new Error('Resposta de contato inválida.');
  return data;
}
