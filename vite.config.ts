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

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '127.0.0.1',
        strictPort: false,
      },
      plugins: [react(), copyPaintCatalog()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
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
        cssCodeSplit: false
      }
    };
});
