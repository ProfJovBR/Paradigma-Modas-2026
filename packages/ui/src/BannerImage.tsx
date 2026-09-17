import { useEffect, useState } from 'react';
import { BANNER_BUCKET, type Banner, type BannerSlot, type SupabaseClient } from '@paradigma/core';
import { ReferencePhoto } from './Commerce';

export function BannerFallback({ slot }: { slot: BannerSlot }) {
  return <ReferencePhoto crop={slot === 'hero' ? [475, 94, 578, 386] : [535, 995, 485, 164]} align={slot === 'cta' ? 'xMinYMid' : 'xMidYMid'} />;
}
export function BannerImage({ client, slot, banner, previewUrl, previewAlt, onFailure }: {
  client: SupabaseClient | null; slot: BannerSlot; banner?: Banner | null;
  previewUrl?: string; previewAlt?: string; onFailure?: (failed: boolean) => void;
}) {
  const [image, setImage] = useState<{ path: string; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const path = banner?.path;
  useEffect(() => {
    let active = true; let url = '';
    setImage(null); setFailed(false); onFailure?.(false);
    if (client && path && !previewUrl) void client.storage.from(BANNER_BUCKET).download(path).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setFailed(true); onFailure?.(true); return; }
      url = URL.createObjectURL(data); setImage({ path, url });
    }).catch(() => { if (active) { setFailed(true); onFailure?.(true); } });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [client, path, previewUrl, attempt, onFailure]);
  useEffect(() => {
    if (!failed) return;
    const retry = () => { if (document.visibilityState === 'visible') setAttempt(n => n + 1); };
    const timer = window.setInterval(retry, 60000);
    window.addEventListener('focus', retry);
    return () => { clearInterval(timer); window.removeEventListener('focus', retry); };
  }, [failed]);
  const url = previewUrl || (image?.path === path ? image?.url : undefined);
  if (!url || failed) return <BannerFallback slot={slot} />;
  return <div className="reference-photo managed-banner-image"><img src={url} alt={previewAlt ?? banner?.alt ?? ''}
    onError={() => { setFailed(true); onFailure?.(true); }} /></div>;
}
