/** Fail closed on Pages; local development may still show unconfigured states. */
export function validatePagesEnvironment(env: Record<string, string>, admin = false) {
  if (env.CF_PAGES !== '1') return;
  const requireHttps = (name: string) => {
    try {
      const url = new URL(env[name]?.trim());
      if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error();
    } catch {
      throw new Error(`Cloudflare Pages: configure ${name} com uma URL HTTPS publica antes do build.`);
    }
  };
  requireHttps('VITE_SUPABASE_URL');
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim().startsWith('sb_publishable_')) {
    throw new Error('Cloudflare Pages: configure VITE_SUPABASE_PUBLISHABLE_KEY com uma chave publica sb_publishable_.');
  }
  if (admin) requireHttps('VITE_LOJA_URL');
}
