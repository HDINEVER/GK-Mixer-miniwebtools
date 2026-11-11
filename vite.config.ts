import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function copyPaintCatalog(): Plugin {
  const copy = () => {
    const src = path.resolve(__dirname, '../GK-Mixer/GK-Mixer/Resources/PaintCatalog.json');
    const destDir = path.resolve(__dirname, 'public');
    const dest = path.join(destDir, 'PaintCatalog.json');
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  };
  return {
    name: 'copy-paint-catalog',
    buildStart: copy,
    configureServer: copy,
  };
}

/** 本地 dev / preview 下模拟 Cloudflare Pages Function：GET /api/dammiz-scheme?id=917 */
function dammizSchemeProxy(): Plugin {
  const handler = async (req: any, res: any) => {
    const url = new URL(req.url || '', 'http://localhost');
    const { fetchDammizScheme } = await import('./functions/_lib/dammiz.js');
    const { status, body } = await fetchDammizScheme(url.searchParams.get('id') ?? '');
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(body));
  };
  return {
    name: 'dammiz-scheme-proxy',
    configureServer(server) {
      server.middlewares.use('/api/dammiz-scheme', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/dammiz-scheme', handler);
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '127.0.0.1',
        strictPort: false,
      },
      plugins: [react(), copyPaintCatalog(), dammizSchemeProxy()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'lucide-react': path.resolve(__dirname, './components/lucide-shim.tsx'),
        }
      },
      css: {
        postcss: './postcss.config.js',
        preprocessorOptions: {
          scss: {
            // 可选的 SCSS 选项
          }
        }
      },
      build: {
        cssCodeSplit: false,
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
          }
        }
      }
    };
});
