import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Search, Heart, Menu, PackageOpen, ShoppingBag } from 'lucide-react';
import { CampaignHero, CategoryTiles, CampaignBanner } from './Commerce';
export * from './Commerce';
export { CatalogImage } from './CatalogImage';
export { usePublishedTheme } from './usePublishedTheme';

export function Brand({ small = false }: { small?: boolean }) { return <span className={`brand ${small ? 'brand-small' : ''}`}>Paradigma</span>; }
export function Button({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`button ${className}`} {...props}>{children}</button>; }
export function EmptyState({ title, description, icon, children }: { title: string; description: string; icon?: ReactNode; children?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <PackageOpen size={32} strokeWidth={1.3} />}</div><h3>{title}</h3><p>{description}</p>{children}</div>;
}
export function StorePreview() {
  return <div className="store-preview"><div className="announcement">MODA COM PROPÓSITO · NOVOS COMEÇOS</div><header><Brand small /><span className="action-row"><Search size={17} /><Heart size={17} /><ShoppingBag size={17} /><Menu size={17} /></span></header><CampaignHero /><CategoryTiles /><div className="preview-catalog"><h3>DESTAQUES DA SEMANA</h3><EmptyState title="Prévia do catálogo" description="Os produtos publicados aparecem na loja. Esta prévia mostra somente a identidade visual." /></div><CampaignBanner /></div>;
}
