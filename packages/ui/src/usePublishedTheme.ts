import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultTheme, isTheme, themeValidation, type Theme } from './theme';

export function usePublishedTheme(client: SupabaseClient | null) {
  const [theme, setTheme] = useState<Theme>({ ...defaultTheme });
  useEffect(() => {
    if (!client) return;
    let active = true;
    let latest = 0;
    async function refresh() {
      const request = ++latest;
      try {
        const { data, error } = await client!.from('theme_settings').select('published').maybeSingle();
        if (!active || request !== latest || error) return;
        if (data?.published === null) setTheme({ ...defaultTheme });
        else if (isTheme(data?.published) && !themeValidation(data.published)) setTheme(data.published);
      } catch { /* Keep the last valid theme while offline. */ }
    }
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    const interval = window.setInterval(visible, 60000);
    window.addEventListener('focus', visible);
    window.addEventListener('hashchange', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', visible);
      window.removeEventListener('hashchange', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [client]);
  return theme;
}
