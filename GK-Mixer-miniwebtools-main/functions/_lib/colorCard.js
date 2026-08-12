/**
 * Shared helpers for color share pages / OG PNG.
 */

export function normalizeHex(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/^#/, '')
    .toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(cleaned)) return null;
  return cleaned;
}

export function parseQuery(searchParams) {
  return {
    hex: searchParams.get('hex') || '',
    n: searchParams.get('n') || '',
    r: searchParams.get('r') || '',
    rn: searchParams.get('rn') || '',
  };
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunk(type, data) {
  const typeBytes = [...type].map((ch) => ch.charCodeAt(0));
  const len = u32(data.length);
  const body = Uint8Array.from([...typeBytes, ...data]);
  const crc = u32(crc32(body));
  return Uint8Array.from([...len, ...body, ...crc]);
}

function deflateStore(data) {
  // zlib wrapper around uncompressed DEFLATE stored blocks (no compression).
  const blocks = [];
  let offset = 0;
  while (offset < data.length) {
    const size = Math.min(65535, data.length - offset);
    const isFinal = offset + size >= data.length ? 1 : 0;
    const header = [isFinal, size & 0xff, (size >> 8) & 0xff, ~size & 0xff, (~size >> 8) & 0xff];
    blocks.push(Uint8Array.from(header));
    blocks.push(data.subarray(offset, offset + size));
    offset += size;
  }
  const concat = concatBytes(blocks);
  const cmf = 0x78;
  const flg = 0x01; // checksum-compatible flags for stored stream
  // Actually 0x78 0x01 is valid zlib header (CM=8, CINFO=7, FCHECK).
  const adler = adler32(data);
  return Uint8Array.from([cmf, flg, ...concat, ...u32(adler)]);
}

function adler32(buf) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function concatBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/**
 * Build a 1200×630 PNG: left ~58% solid swatch, right light panel with accent bar.
 * (Text is intentionally omitted from the bitmap; OG title/description carry copy.)
 */
export function buildColorCardPNG({ hex }) {
  const width = 1200;
  const height = 630;
  const split = Math.floor(width * 0.58);
  const { r, g, b } = hexToRgb(hex);
  const row = new Uint8Array((width * 3) + 1); // filter byte + RGB

  const raw = new Uint8Array((row.length) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * row.length;
    raw[rowStart] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const i = rowStart + 1 + x * 3;
      if (x < split) {
        raw[i] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
      } else {
        // Soft panel
        raw[i] = 250;
        raw[i + 1] = 250;
        raw[i + 2] = 250;
        // Top accent strip mirroring the color
        if (y < 18) {
          raw[i] = r;
          raw[i + 1] = g;
          raw[i + 2] = b;
        }
        // Left border line
        if (x === split) {
          raw[i] = Math.max(0, r - 30);
          raw[i + 1] = Math.max(0, g - 30);
          raw[i + 2] = Math.max(0, b - 30);
        }
      }
    }
  }

  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk(
    'IHDR',
    Uint8Array.from([
      ...u32(width),
      ...u32(height),
      8, // bit depth
      2, // truecolor
      0,
      0,
      0,
    ])
  );
  const idat = chunk('IDAT', deflateStore(raw));
  const iend = chunk('IEND', new Uint8Array());
  return concatBytes([signature, ihdr, idat, iend]);
}
