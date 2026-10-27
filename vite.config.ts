import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const pacote = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Política de segurança só no build: o servidor de desenvolvimento do Vite injeta
// estilos e scripts inline que ela bloquearia.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

function cspNoBuild(): Plugin {
  return {
    name: 'penny-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  base: './', // funciona em https://usuario.github.io/penny/
  plugins: [cspNoBuild()],
  define: { __VERSAO__: JSON.stringify(pacote.version) },
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
