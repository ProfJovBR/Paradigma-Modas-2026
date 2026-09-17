import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, CreditCard, Diamond, Leaf, Package, ShieldCheck, Truck, Users, X } from 'lucide-react';
import homeReference from '../../../docs/referencias/ChatGPT Image 6 de set. de 2026, 02_07_02 (1).png';
import catalogReference from '../../../docs/referencias/ChatGPT Image 6 de set. de 2026, 02_07_02 (2).png';
import adminReference from '../../../docs/referencias/ChatGPT Image 6 de set. de 2026, 02_07_02 (6).png';

// Only institutional photography is framed from the approved references. Product data is never taken from them.
export function ReferencePhoto({ crop, source = 'home', className = '', align = 'xMidYMid' }: { crop: [number, number, number, number]; source?: 'home' | 'admin' | 'catalog'; className?: string; align?: string }) {
  const [x, y, width, height] = crop;
  return <div className={`reference-photo ${className}`} aria-hidden="true"><svg viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio={`${align} slice`} width="100%" height="100%"><image href={source === 'home' ? homeReference : source === 'catalog' ? catalogReference : adminReference} width="1055" height="1491" /></svg></div>;
}
export function CampaignHero({ compact = false, admin = false, image }: { compact?: boolean; admin?: boolean; image?: ReactNode }) {
  return <section className={`campaign-hero ${compact ? 'compact' : ''} ${admin ? 'admin-campaign' : ''}`}>
    {image ?? <ReferencePhoto source={admin ? 'admin' : compact ? 'catalog' : 'home'} crop={admin ? [527, 102, 503, 242] : compact ? [529, 94, 524, 229] : [475, 94, 578, 386]} />}
    <div className="campaign-copy"><span className="eyebrow">{admin ? 'BEM-VINDO(A) AO SEU PAINEL' : compact ? 'NOVIDADES' : 'NOVOS COMEÇOS'}</span><h1>{admin ? <>Grandes marcas<br />começam com<br />grandes decisões.</> : compact ? <>O novo combina<br />com você.</> : <>Estilo hoje.<br />Um amanhã melhor.</>}</h1><p>{admin ? 'GERENCIE, ANALISE E FAÇA SUA LOJA IR AINDA MAIS LONGE.' : 'MODA QUE TE ACOMPANHA EM TODAS AS SUAS VERSÕES.'}</p>{!admin && <a className="button" href="#catalogo">EXPLORAR COLEÇÃO <ArrowRight size={17} /></a>}{!compact && !admin && <div className="hero-values"><span><Leaf />MODA COM<br />PROPÓSITO</span><span><Diamond />SUA<br />IDENTIDADE</span><span><Users />NOVAS<br />HISTÓRIAS</span></div>}</div>
  </section>;
}
export function CategoryTiles() {
  return <section className="category-section"><div className="section-heading"><h2>COMPRE POR CATEGORIA</h2><a href="#catalogo">VER TODAS <ArrowRight size={14} /></a></div><div className="category-grid">{[
    { name: 'Feminino', crop: [35, 530, 236, 159] as [number, number, number, number] },
    { name: 'Masculino', crop: [285, 530, 236, 159] as [number, number, number, number] },
    { name: 'Acessórios', crop: [535, 530, 236, 159] as [number, number, number, number] },
    { name: 'Novidades', crop: [787, 530, 236, 159] as [number, number, number, number] },
  ].map(item => <a key={item.name} href={`#catalogo?colecao=${encodeURIComponent(item.name)}`} aria-label={`Explorar ${item.name}`}><ReferencePhoto crop={item.crop} /><span className="sr-only">{item.name}</span></a>)}</div></section>;
}
export function CampaignBanner({ image }: { image?: ReactNode }) {
  return <section className="campaign-banner">{image ?? <ReferencePhoto crop={[535, 995, 485, 164]} align="xMinYMid" />}<div><span className="eyebrow">SEU PRÓXIMO LOOK</span><h2>Mais que moda.<br />Novas possibilidades.</h2><a className="button dark" href="#catalogo">EXPLORAR PEÇAS <ArrowRight size={15} /></a></div></section>;
}
export function Benefits() {
  return <div className="benefits">{[{ icon: Truck, title: 'ENTREGA', text: 'Consulte as condições' }, { icon: CreditCard, title: 'PAGAMENTO', text: 'Opções no fechamento' }, { icon: Package, title: 'TROCAS', text: 'Consulte nossa política' }, { icon: ShieldCheck, title: 'ATENDIMENTO', text: 'Conte com a Paradigma' }, { icon: Leaf, title: 'MODA COM PROPÓSITO', text: 'Seu jeito de se vestir' }].map(item => <div key={item.title}><item.icon size={27} strokeWidth={1.5} /><span><strong>{item.title}</strong><small>{item.text}</small></span></div>)}</div>;
}
export function Skeleton({ label = 'Carregando…', cards = 4 }: { label?: string; cards?: number }) {
  return <div role="status" className="skeleton-block"><span className="sr-only">{label}</span><div className="skeleton-grid" aria-hidden="true">{Array.from({ length: cards }, (_, index) => <div key={index}><div className="skeleton photo" /><div className="skeleton line" /><div className="skeleton line short" /></div>)}</div></div>;
}
export function Drawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; const before = document.activeElement as HTMLElement; dialog.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { dialog.close(); document.body.style.overflow = overflow; before?.focus(); }; }, []);
  return <dialog ref={ref} className="drawer" aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="drawer-content"><div className="subheading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={`Fechar ${title.toLowerCase()}`}><X /></button></div>{children}</div></dialog>;
}
