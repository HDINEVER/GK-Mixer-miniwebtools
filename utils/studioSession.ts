/**
 * 模拟试色台「可回溯工程快照」序列化工具
 * - 已涂装区域像素索引 → 排序后 [start, length] 游程编码 → base64
 * - 用户线稿修补 (Int8Array) → [value, count] 游程编码 → base64
 */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]
    );
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Encodes a set of pixel indices as sorted run-length pairs [start, len, start, len, ...] */
export function encodePixelIndexRuns(pixels: Uint32Array): string {
  if (pixels.length === 0) return "";
  const sorted = Uint32Array.from(pixels).sort();
  const runs: number[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const v = sorted[i];
    if (v === prev) continue;
    if (v === prev + 1) {
      prev = v;
      continue;
    }
    runs.push(start, prev - start + 1);
    start = v;
    prev = v;
  }
  runs.push(start, prev - start + 1);
  return bytesToBase64(new Uint8Array(Uint32Array.from(runs).buffer));
}

export function decodePixelIndexRuns(encoded: string, maxIndex: number): Uint32Array {
  if (!encoded) return new Uint32Array(0);
  const bytes = base64ToBytes(encoded);
  const runs = new Uint32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  let total = 0;
  for (let i = 1; i < runs.length; i += 2) total += runs[i];
  const out = new Uint32Array(total);
  let k = 0;
  for (let i = 0; i + 1 < runs.length; i += 2) {
    const s = runs[i];
    const len = runs[i + 1];
    for (let j = 0; j < len; j++) {
      const idx = s + j;
      if (idx < maxIndex) out[k++] = idx;
    }
  }
  return k === total ? out : out.subarray(0, k);
}

/** Run-length encodes an Int8Array as [value, count] Int32 pairs */
export function encodeInt8Rle(arr: Int8Array): string {
  if (arr.length === 0) return "";
  const pairs: number[] = [];
  let cur = arr[0];
  let count = 1;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === cur) {
      count++;
    } else {
      pairs.push(cur, count);
      cur = arr[i];
      count = 1;
    }
  }
  pairs.push(cur, count);
  return bytesToBase64(new Uint8Array(Int32Array.from(pairs).buffer));
}

export function decodeInt8Rle(encoded: string, length: number): Int8Array {
  const out = new Int8Array(length);
  if (!encoded) return out;
  const bytes = base64ToBytes(encoded);
  const pairs = new Int32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  let k = 0;
  for (let i = 0; i + 1 < pairs.length && k < length; i += 2) {
    const v = pairs[i];
    const c = pairs[i + 1];
    const end = Math.min(length, k + c);
    if (v !== 0) out.fill(v, k, end);
    k = end;
  }
  return out;
}

/** Checks whether an image source string is a valid renderable URL / DataURL (guards against accidental Event objects) */
export function isValidImageSrc(src: unknown): src is string {
  return (
    typeof src === "string" &&
    src.length > 5 &&
    (src.startsWith("data:image/") ||
      src.startsWith("blob:") ||
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("/"))
  );
}

/** Returns a guaranteed valid image URL for a PartCanvas, falling back to studioSession if sourceImageDataUrl was corrupted */
export function resolvePartImageSrc(
  part?: {
    sourceImageDataUrl?: unknown;
    studioSession?: {
      compositedPreviewDataUrl?: string;
      rawSourceImageDataUrl?: string;
    };
  } | null
): string {
  if (!part) return "";
  if (isValidImageSrc(part.sourceImageDataUrl)) {
    return part.sourceImageDataUrl;
  }
  if (isValidImageSrc(part.studioSession?.compositedPreviewDataUrl)) {
    return part.studioSession!.compositedPreviewDataUrl!;
  }
  if (isValidImageSrc(part.studioSession?.rawSourceImageDataUrl)) {
    return part.studioSession!.rawSourceImageDataUrl!;
  }
  return "";
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = (hex || "#808080").replace("#", "").trim();
  const n = parseInt(
    clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean,
    16
  );
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Reconstructs the painted composite PNG from a StudioSessionSnapshot (used to self-heal corrupted part.sourceImageDataUrl) */
export async function reconstructCompositeFromSession(snap: {
  rawSourceImageDataUrl?: string;
  compositedPreviewDataUrl?: string;
  workWidth?: number;
  workHeight?: number;
  regions?: Array<{
    baseHex: string;
    shadeHex: string;
    highlightHex: string;
    baseLum?: number;
    pixelsRle: string;
  }>;
}): Promise<string | null> {
  if (isValidImageSrc(snap?.compositedPreviewDataUrl)) {
    return snap.compositedPreviewDataUrl!;
  }
  if (!isValidImageSrc(snap?.rawSourceImageDataUrl)) {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = snap.workWidth || img.naturalWidth || img.width;
        const h = snap.workHeight || img.naturalHeight || img.height;
        if (w <= 0 || h <= 0) {
          resolve(snap.rawSourceImageDataUrl || null);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(snap.rawSourceImageDataUrl || null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        if (snap.regions && snap.regions.length > 0) {
          const im = ctx.getImageData(0, 0, w, h);
          const data = im.data;
          const total = w * h;
          for (const reg of snap.regions) {
            const px = decodePixelIndexRuns(reg.pixelsRle, total);
            const [br, bg, bb] = parseHexRgb(reg.baseHex);
            const [sr, sg, sb] = parseHexRgb(reg.shadeHex || reg.baseHex);
            const [hr, hg, hb] = parseHexRgb(reg.highlightHex || reg.baseHex);
            const refLum = Math.max(24, Math.min(235, reg.baseLum || 140));
            for (let k = 0; k < px.length; k++) {
              const idx = px[k];
              const p = idx << 2;
              const lum = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
              const ratio = (lum - refLum) / 110;
              let r = br;
              let g = bg;
              let b = bb;
              if (ratio < 0) {
                const t = Math.min(1, -ratio);
                r = Math.round(br + (sr - br) * t);
                g = Math.round(bg + (sg - bg) * t);
                b = Math.round(bb + (sb - bb) * t);
              } else if (ratio > 0) {
                const t = Math.min(1, ratio);
                r = Math.round(br + (hr - br) * t);
                g = Math.round(bg + (hg - bg) * t);
                b = Math.round(bb + (hb - bb) * t);
              }
              data[p] = r;
              data[p + 1] = g;
              data[p + 2] = b;
            }
          }
          ctx.putImageData(im, 0, 0);
        }
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(snap.rawSourceImageDataUrl || null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = snap.rawSourceImageDataUrl!;
  });
}
