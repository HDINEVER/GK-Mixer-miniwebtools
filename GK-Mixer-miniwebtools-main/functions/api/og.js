/**
 * Open Graph color card PNG — /api/og?hex=RRGGBB&n=Name&r=3020&rn=Traffic+red
 * Returns a 1200×630 PNG: left color panel + right info panel (no text glyphs;
 * title/description live in HTML OG tags).
 */
import { buildColorCardPNG, normalizeHex, parseQuery } from '../_lib/colorCard.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = parseQuery(url.searchParams);
  const hex = normalizeHex(q.hex || url.searchParams.get('hex') || '000000');

  if (!hex) {
    return new Response('Invalid hex', { status: 400 });
  }

  const png = buildColorCardPNG({
    hex,
    name: q.n || '',
    ralNumber: q.r || '',
    ralName: q.rn || '',
  });

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
