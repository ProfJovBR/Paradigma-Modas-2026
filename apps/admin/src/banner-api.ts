import { BANNER_BUCKET, isBanner, validateBannerImage, type Banner, type BannerSlot } from '@paradigma/core';
import { checked, db } from './catalog-api';

export async function loadBanner(slot: BannerSlot): Promise<Banner> {
  const { data } = await checked(db().from('site_banners').select('slot,path,alt,revision').eq('slot', slot).single());
  if (!isBanner(data) || data.slot !== slot) throw new Error('Invalid banner response');
  return data;
}
export async function cleanupBannerFiles() {
  for (let batch = 0; batch < 10; batch++) {
    const { data } = await checked(db().rpc('claim_banner_cleanup'));
    if (!Array.isArray(data) || !data.every(path => typeof path === 'string')) throw new Error('Invalid cleanup response');
    if (!data.length) return;
    await checked(db().storage.from(BANNER_BUCKET).remove(data));
  }
  // Re-querying also detects a successful HTTP response that deleted no files after revocation.
  throw new Error('Cleanup still pending');
}
export class BannerSaveError extends Error {
  constructor(message: string, readonly reloadRequired = false) { super(message); }
}
export function bannerErrorMessage(error: unknown) {
  if (error instanceof BannerSaveError) return error.message;
  const code = (error as { code?: string })?.code;
  if (code === '42501') return 'Sua conta não tem permissão para alterar banners. Entre novamente no painel.';
  if (['PGRST202', 'PGRST205', '42P01'].includes(code ?? '')) return 'Ative os banners aplicando a migration 202609160001_banners.sql no Supabase e tente novamente.';
  return 'Não foi possível carregar o banner. Confira a conexão e a configuração do Supabase e tente novamente.';
}
export async function publishBanner(saved: Banner, file: File | null, remove: boolean, alt: string) {
  let uploadedPath: string | null = null;
  let publishing = false;
  try {
    if (alt.length > 300) throw new BannerSaveError('O texto alternativo deve ter até 300 caracteres.');
    if (file) {
      const extension = await validateBannerImage(file);
      const { data } = await checked(db().rpc('prepare_banner_upload', { p_slot: saved.slot, p_extension: extension }));
      if (typeof data !== 'string' || !isBanner({ ...saved, path: data })) throw new Error('Invalid upload path');
      uploadedPath = data;
      await checked(db().storage.from(BANNER_BUCKET).upload(uploadedPath, file, { contentType: file.type, cacheControl: '0', upsert: false }));
    }
    publishing = true;
    const { data } = await checked(db().rpc('publish_banner', {
      p_slot: saved.slot, p_path: remove ? null : uploadedPath ?? saved.path,
      p_alt: alt.trim(), p_revision: saved.revision,
    }));
    if (!isBanner(data) || data.slot !== saved.slot) throw new Error('Invalid publication response');
    return data;
  } catch (error) {
    if (uploadedPath) {
      // This RPC will NOT retire a published file if the publication response was lost.
      try { await checked(db().rpc('discard_banner_upload', { p_path: uploadedPath })); await cleanupBannerFiles(); }
      catch { /* Tracked uploads are retried when opening Banners; abandoned pending files expire after 24h. */ }
    }
    const code = (error as { code?: string })?.code;
    if (code === '40001') throw new BannerSaveError('Este banner foi alterado em outra aba. Recarregue o banner publicado antes de salvar.', true);
    if (code === '42501') throw new BannerSaveError(bannerErrorMessage(error), true);
    if (publishing) throw new BannerSaveError('Não foi possível confirmar a publicação. Recarregue o banner publicado para conferir o estado no servidor antes de tentar novamente.', true);
    if (error instanceof BannerSaveError) throw error;
    throw new BannerSaveError('Não foi possível enviar a imagem. O banner publicado não foi alterado. Tente novamente.');
  }
}
