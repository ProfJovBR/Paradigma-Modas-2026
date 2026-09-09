import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
export function CatalogImage({ client, path, alt }: { client: SupabaseClient; path?: string; alt: string }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; let objectUrl = '';
    setUrl(''); setFailed(false);
    if (path) void client.storage.from('catalog').download(path).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setFailed(true); return; }
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [client, path, attempt]);
  return url ? <img src={url} alt={alt} className="catalog-image" onError={() => { setUrl(''); setFailed(true); }} /> : <div className="image-placeholder"><ImageOff size={28} /><span>{!path ? 'Sem foto' : failed ? 'Foto indisponível' : 'Carregando foto'}</span>{failed && <button type="button" onClick={() => setAttempt(attempt + 1)}>Tentar novamente</button>}</div>;
}
