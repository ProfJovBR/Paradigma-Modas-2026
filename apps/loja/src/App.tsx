import { useEffect, useState } from 'react';
import { ArrowRight, Heart, Instagram, Leaf, Menu, Search, ShoppingBag, Truck, UserRound } from 'lucide-react';
import { BannerImage, usePublishedBanners, Benefits, Brand, CampaignBanner, CampaignHero, CategoryTiles, Drawer, EmptyState, usePublishedTheme } from '@paradigma/ui';
import { Catalog, ProductPage } from './Catalog';
import { BasketPage, BasketProvider, FavoritesPage, useBasket } from './Basket';
import { supabase } from './supabase';
import { AccountPage, CustomerProvider, useCustomer } from './CustomerAccount';
import './customer-account.css';
import { themeStyle } from '@paradigma/ui/theme';

export default function App() { return <CustomerProvider><BasketProvider><Store /></BasketProvider></CustomerProvider>; }
function Store() {
  const { openAccount, loading: accountLoading } = useCustomer();
  const theme = usePublishedTheme(supabase);
  const banners = usePublishedBanners(supabase);
  const [route, setRoute] = useState(window.location.hash);
  const [menu, setMenu] = useState(false); const [query, setQuery] = useState('');
  const { items, favorites } = useBasket();
  useEffect(() => { const sync = () => { setRoute(window.location.hash); setMenu(false); window.scrollTo(0, 0); }; window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  const navigation = <>{['Feminino', 'Masculino', 'Acessórios', 'Novidades'].map(name => <a key={name} href={`#catalogo?colecao=${encodeURIComponent(name)}`}>{name}</a>)}<a href="#catalogo">Catálogo</a><a href="#marca">Sobre</a></>;
  const isCatalog = route.startsWith('#catalogo'); const productId = route.startsWith('#produto/') ? route.slice(9) : null;
  const params = new URLSearchParams(route.split('?')[1]);
  return <div className="store" style={themeStyle(theme)}><a className="skip-link" href="#catalogo">Ir para o catálogo</a>
    <div className="announcement"><span><Truck size={14} /> NOVOS COMEÇOS. NOVAS POSSIBILIDADES.</span><span>ENCONTRE SEU PRÓXIMO LOOK <ArrowRight size={13} /></span><span>Moda com propósito. Seu ponto de vista. <Leaf size={14} /></span></div>
    <header className="store-header"><a href="#" aria-label="Paradigma, início"><Brand /></a><nav aria-label="Navegação da loja">{navigation}</nav><form className="header-search" onSubmit={e => { e.preventDefault(); window.location.hash = `catalogo?busca=${encodeURIComponent(query)}`; }}><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Pesquisar na loja" placeholder="Buscar produtos, marcas, estilos…" /><button aria-label="Pesquisar" className="icon-button"><Search size={21} /></button></form><div className="header-actions"><button className="icon-button" onClick={openAccount} disabled={accountLoading} aria-label="Minha conta"><UserRound /></button><a className="icon-button counter" href="#favoritos" aria-label="Favoritos"><Heart />{favorites.length > 0 && <small>{favorites.length}</small>}</a><a className="icon-button counter" href="#carrinho" aria-label="Carrinho"><ShoppingBag /><small>{items.reduce((s, i) => s + i.quantity, 0)}</small></a><button className="icon-button store-menu" aria-label="Abrir menu da loja" onClick={() => setMenu(true)}><Menu /></button></div></header>
    {menu && <Drawer title="Menu da loja" onClose={() => setMenu(false)}><nav className="drawer-nav">{navigation}</nav></Drawer>}
    <main>{productId !== null ? <ProductPage key={productId} id={productId} /> : isCatalog ? <><div className="breadcrumb shop-container"><a href="#">Início</a><span>›</span>{params.get('colecao') ?? 'Catálogo'}</div><CampaignHero compact /><Catalog key={route} initialQuery={params.get('busca') ?? ''} collection={params.get('colecao') ?? ''} /></> : route === '#carrinho' ? <BasketPage /> : route === '#checkout' ? <BasketPage checkout /> : route === '#favoritos' ? <FavoritesPage /> : route === '#conta' ? <AccountPage /> : route === '#marca' || route.startsWith('#informacoes') ? <div className="shop-container"><h1 className="display-title">{route === '#marca' ? 'Mais que moda. Um novo olhar.' : 'Informações da loja'}</h1><p className="muted">Paradigma. Moda é um ponto de vista. E o seu, muda tudo.</p><EmptyState title="Vamos conversar?" description="Os canais de atendimento e as políticas comerciais serão publicados aqui assim que estiverem disponíveis." /><a href="#catalogo" className="button">Ver coleção</a></div> : <><CampaignHero image={<BannerImage client={supabase} slot="hero" banner={banners.hero} />} /><div className="shop-container home-sections"><CategoryTiles /></div><Catalog featured title="DESTAQUES DA SEMANA" /><div className="shop-container"><CampaignBanner image={<BannerImage client={supabase} slot="cta" banner={banners.cta} />} /></div></>}</main>
    <Benefits />{route !== '#checkout' && <section className="newsletter"><div><h2>Faça parte da nossa comunidade</h2><p>Novidades, lançamentos e um novo olhar para a moda.</p></div><div><div className="inline-form"><input type="email" aria-label="Seu melhor e-mail" placeholder="Seu melhor e-mail" disabled /><button className="button" disabled>QUERO RECEBER</button></div><small>Inscrições disponíveis em breve.</small></div></section>}
    <footer className="store-footer"><div className="footer-columns"><div><Brand /><p>Moda é um ponto de vista.<br />E o seu, muda tudo.</p></div>{[{ title: 'ATENDIMENTO', links: ['Central de ajuda', 'Trocas e devoluções', 'Status do pedido', 'Fale conosco'] }, { title: 'SOBRE A PARADIGMA', links: ['Nossa história', 'Moda com propósito', 'Nossa comunidade'] }, { title: 'INFORMAÇÕES', links: ['Política de privacidade', 'Termos de uso', 'Formas de pagamento', 'Entrega'] }].map(col => <div key={col.title}><h3>{col.title}</h3>{col.links.map(label => <a key={label} href={`#informacoes/${encodeURIComponent(label)}`}>{label}</a>)}</div>)}<div><h3>ACOMPANHE A GENTE</h3><Instagram size={21} /><p>#MaisQueModa</p></div></div><div className="footer-bottom"><small>© {new Date().getFullYear()} Paradigma. Todos os direitos reservados.</small><small><Leaf size={14} /> Feito por pessoas reais, para um mundo mais plural.</small></div></footer>
  </div>;
}
