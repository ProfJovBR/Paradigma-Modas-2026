import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { Brand, usePublishedTheme } from '@paradigma/ui';
import { Catalog, ProductPage } from './Catalog';
import { supabase } from './supabase';
import { themeStyle } from '@paradigma/ui/theme';

export default function App() {
  const theme = usePublishedTheme(supabase);
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => { const sync = () => { setRoute(window.location.hash); if (window.location.hash.startsWith('#produto/')) window.scrollTo(0, 0); }; window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  const productId = route.startsWith('#produto/') ? route.slice(9) : null;
  return <div className="store" style={themeStyle(theme)}>
    <a className="skip-link" href="#catalogo">Ir para o catálogo</a>
    <div className="announcement">Um novo olhar para o seu vestir.</div>
    <header className="store-header"><a href="#" aria-label="Paradigma, início"><Brand /></a><nav aria-label="Navegação da loja"><a href="#catalogo">Catálogo</a><a href="#marca">A Paradigma <ArrowUpRight size={14} /></a></nav><span className="opening-label"><span /> Catálogo</span></header>
    <main>{productId !== null ? <ProductPage key={productId} id={productId} /> : <>
      <section className="store-intro" aria-labelledby="store-title"><div className="intro-top"><span className="eyebrow">UM NOVO COMEÇO</span><span className="eyebrow">MODA • IDENTIDADE • EXPRESSÃO</span></div><h1 id="store-title">PARADIGMA<span>.</span></h1><div className="intro-bottom"><p>Seu estilo.<br /><em>Seu ponto de vista.</em></p><a className="circle-link" href="#catalogo" aria-label="Explorar catálogo"><ArrowDown size={26} /></a><p className="intro-note">Estamos preparando<br />o nosso próximo capítulo.</p></div></section>
      <Catalog />
      <section id="marca" className="brand-band"><span className="eyebrow">A PARADIGMA</span><h2>Moda é um ponto de vista.<br /><em>O seu.</em></h2><ArrowUpRight size={48} strokeWidth={1} aria-hidden="true" /></section>
    </>}</main><footer className="store-footer"><Brand small /><span>PARADIGMA</span><a href="#catalogo">Voltar ao catálogo <ArrowUpRight size={15} /></a></footer>
  </div>;
}
