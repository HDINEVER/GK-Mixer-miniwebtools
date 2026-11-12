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

/** 本地 dev / preview 下模拟 Cloudflare Pages Function：POST /api/ai-render & /api/ai-wallet */
function aiStudioProxy(env: Record<string, string>): Plugin {
  const readJsonBody = (req: any): Promise<any> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve(raw ? JSON.parse(raw) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });

  const walletHandler = async (req: any, res: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const body = await readJsonBody(req);
      const { processWalletAction } = await import('./functions/_lib/aiStudio.js');
      const result = await processWalletAction(env, body, '127.0.0.1');
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } catch (err: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: err?.message || '请求失败' }));
    }
  };

  const renderHandler = async (req: any, res: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const body = await readJsonBody(req);
      const { processAiRenderRequest } = await import('./functions/_lib/aiStudio.js');
      const result = await processAiRenderRequest(env, body, '127.0.0.1');
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } catch (err: any) {
      res.statusCode =
        err?.code === 'INSUFFICIENT_CREDITS'
          ? 402
          : err?.code === 'OFFICIAL_NOT_CONFIGURED'
          ? 503
          : 400;
      res.end(
        JSON.stringify({
          ok: false,
          code: err?.code || 'RENDER_FAILED',
          error: err?.message || 'AI 渲染请求失败',
          wallet: err?.wallet || undefined,
        })
      );
    }
  };

  return {
    name: 'ai-studio-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai-wallet', walletHandler);
      server.middlewares.use('/api/ai-render', renderHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/ai-wallet', walletHandler);
      server.middlewares.use('/api/ai-render', renderHandler);
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
      plugins: [react(), copyPaintCatalog(), dammizSchemeProxy(), aiStudioProxy(env)],
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
