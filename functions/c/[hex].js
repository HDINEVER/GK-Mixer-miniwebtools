/**
 * Share landing page — /c/:hex?n=&r=&rn=
 * Server-rendered HTML with Open Graph tags for link previews.
 */
import { escapeHtml, normalizeHex, parseQuery } from '../_lib/colorCard.js';

const SITE = 'https://gk-colormixer.com.hdinever.top';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const rawHex = context.params?.hex || '';
  const hex = normalizeHex(rawHex);
  if (!hex) {
    return new Response(notFoundHtml(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const q = parseQuery(url.searchParams);
  const name = (q.n || '').trim();
  const ralNumber = (q.r || '').trim();
  const ralName = (q.rn || '').trim();
  const displayHex = `#${hex}`;
  const title = name || displayHex;
  const ralLine =
    ralNumber.length > 0
      ? `RAL ${escapeHtml(ralNumber)}${ralName ? ` ${escapeHtml(ralName)}` : ''}`
      : '';
  const descriptionParts = [displayHex];
  if (ralNumber) {
    descriptionParts.push(
      `RAL ${ralNumber}${ralName ? ` ${ralName}` : ''}`
    );
  }
  const description = `${descriptionParts.join(' · ')} · GK Mixer 调色板色卡`;

  const ogParams = new URLSearchParams({ hex });
  if (name) ogParams.set('n', name);
  if (ralNumber) ogParams.set('r', ralNumber);
  if (ralName) ogParams.set('rn', ralName);
  const ogImage = `${SITE}/api/og?${ogParams.toString()}`;
  const canonical = `${SITE}/c/${hex}${url.search || ''}`;
  const ink = contrastingInk(hex);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · GK Mixer</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="GK Mixer" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #f4f4f5;
      color: #18181b;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      width: min(420px, 100%);
      background: #fff;
      border-radius: 28px;
      padding: 20px;
      box-shadow: 0 18px 50px rgba(0,0,0,.12);
    }
    .swatch {
      aspect-ratio: 1 / 1.05;
      border-radius: 22px;
      background: ${displayHex};
      color: ${ink};
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 22px;
      gap: 8px;
    }
    .name { font-size: 1.55rem; font-weight: 700; line-height: 1.2; }
    .hex { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.25rem; font-weight: 700; opacity: .92; }
    .ral { font-size: .95rem; opacity: .85; }
    .meta { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; color: #71717a; font-size: .9rem; }
    .brand { font-weight: 700; color: #3f3f46; }
    .cta {
      display: block;
      margin-top: 18px;
      text-align: center;
      text-decoration: none;
      background: #18181b;
      color: #fff;
      border-radius: 999px;
      padding: 14px 18px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="swatch">
      <div class="name">${escapeHtml(name || 'GK Mixer 色卡')}</div>
      <div class="hex">${escapeHtml(displayHex)}</div>
      ${ralLine ? `<div class="ral">${ralLine}</div>` : ''}
    </div>
    <div class="meta">
      <span class="brand">GK Mixer</span>
      <span>调色板色卡</span>
    </div>
    <a class="cta" href="${SITE}/">打开混色台</a>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function contrastingInk(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? 'rgba(0,0,0,.88)' : 'rgba(255,255,255,.95)';
}

function notFoundHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>色卡未找到</title></head>
<body style="font-family:system-ui;padding:40px"><h1>无效的颜色链接</h1>
<p><a href="${SITE}/">返回 GK Mixer</a></p></body></html>`;
}
