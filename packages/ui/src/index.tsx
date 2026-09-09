import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowUpRight, PackageOpen, ShoppingBag } from 'lucide-react';
export { CatalogImage } from './CatalogImage';
export { usePublishedTheme } from './usePublishedTheme';

export function Brand({ small = false }: { small?: boolean }) { return <span className={`brand ${small ? 'brand-small' : ''}`}>Paradigma<span className="brand-dot">.</span></span>; }
export function Button({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`button ${className}`} {...props}>{children}</button>; }
export function EmptyState({ title, description, icon, children }: { title: string; description: string; icon?: ReactNode; children?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <PackageOpen size={32} strokeWidth={1.3} />}</div><h3>{title}</h3><p>{description}</p>{children}</div>;
}
export function StorePreview() {
  return <div className="store-preview"><div className="announcement">Um novo olhar para o seu vestir.</div><header><Brand small /><ShoppingBag size={19} /></header><div className="preview-banner"><span className="eyebrow">EM BREVE</span><h2>PARADIGMA</h2><p>Seu estilo. Seu ponto de vista.</p></div><div className="preview-catalog"><div className="flex items-center justify-between"><h3>Nosso catálogo</h3><ArrowUpRight size={18} /></div><EmptyState title="Novas peças a caminho" description="O catálogo ainda não está disponível." /></div></div>;
}
