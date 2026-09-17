import { validateImage } from './index';

export type BannerSlot = 'hero' | 'cta';
export type Banner = { slot: BannerSlot; path: string | null; alt: string; revision: string };
export const BANNER_BUCKET = 'banners';
export const BANNER_MAX_BYTES = 5_000_000;
export const bannerDefinitions = {
  hero: { name: 'Hero Banner', dimensions: '1440 × 960 px (3:2)' },
  cta: { name: 'CTA Banner', dimensions: '1440 × 480 px (3:1)' },
} as const;
export function isBanner(value: unknown): value is Banner {
  if (!value || typeof value !== 'object') return false;
  const b = value as Banner;
  return (b.slot === 'hero' || b.slot === 'cta') && typeof b.alt === 'string' && b.alt.length <= 300
    && typeof b.revision === 'string' && /^[0-9a-f-]{36}$/.test(b.revision)
    && (b.path === null || (typeof b.path === 'string' && new RegExp(`^${b.slot}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(b.path)));
}
export async function validateBannerImage(file: File) {
  if (file.size > BANNER_MAX_BYTES) throw new Error('A imagem deve ter até 5 MB (5.000.000 bytes).');
  return validateImage(file);
}
