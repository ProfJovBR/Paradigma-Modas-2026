import { useEffect, useState } from 'react';
import { isBanner, type Banner, type BannerSlot, type SupabaseClient } from '@paradigma/core';

export function usePublishedBanners(client: SupabaseClient | null) {
  const [banners, setBanners] = useState<Partial<Record<BannerSlot, Banner>>>({});
  useEffect(() => {
    if (!client) return;
    let active = true; let latest = 0;
    async function refresh() {
      const request = ++latest;
      try {
        const { data, error } = await client!.from('site_banners').select('slot,path,alt,revision');
        if (!active || request !== latest) return;
        if (error || !Array.isArray(data)) { setBanners({}); return; }
        setBanners(Object.fromEntries(data.filter(isBanner).map(b => [b.slot, b])));
      } catch { if (active && request === latest) setBanners({}); }
    }
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    const timer = window.setInterval(visible, 60000);
    window.addEventListener('focus', visible);
    window.addEventListener('hashchange', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; clearInterval(timer);
      window.removeEventListener('focus', visible);
      window.removeEventListener('hashchange', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [client]);
  return banners;
}
