import type { CSSProperties } from 'react';

export const defaultTheme = { primary: '#ffdf32', background: '#ffffff', text: '#191919', surface: '#f6f6f4' };
export type Theme = typeof defaultTheme;
export const themeLabels: Record<keyof Theme, string> = { primary: 'Cor principal', background: 'Fundo da loja', text: 'Texto', surface: 'Superfícies' };
export function themeStyle(theme: Theme): CSSProperties {
  const muted = contrastRatio('#686a70', theme.background) >= 4.5 && contrastRatio('#686a70', theme.surface) >= 4.5 ? '#686a70' : theme.text;
  return { '--primary': theme.primary, '--background': theme.background, '--text': theme.text, '--surface': theme.surface, '--on-primary': contrastText(theme.primary), '--muted': muted, '--border': theme.text + '40' } as CSSProperties;
}
function luminance(hex: string) {
  const [r, g, b] = hex.slice(1).match(/.{2}/g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}
export function contrastRatio(a: string, b: string) {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}
function contrastText(hex: string) {
  if (contrastRatio(hex, '#191919') >= 4.5) return '#191919';
  return contrastRatio(hex, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';
}
export function isTheme(value: unknown): value is Theme {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 4 && Object.keys(defaultTheme).every(key => typeof record[key] === 'string' && /^#[0-9a-f]{6}$/i.test(record[key] as string));
}
export function themeValidation(theme: Theme): string {
  if (!isTheme(theme)) return 'Use cores no formato hexadecimal, como #FFDF32.';
  if (contrastRatio(theme.text, theme.background) < 4.5 || contrastRatio(theme.text, theme.surface) < 4.5) return 'Aumente o contraste do texto com o fundo e as superfícies antes de publicar (mínimo 4,5:1).';
  return '';
}
