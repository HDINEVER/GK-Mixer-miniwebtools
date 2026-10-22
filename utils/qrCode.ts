/**
 * Self-contained ISO/IEC 18004 QR Code Generator (Byte Mode, Error Correction Level L & M, Versions 1..25)
 * + PNG tEXt chunk metadata embedder/extractor & BarcodeDetector scanner for 100% cross-platform reliability.
 */

type ECLevel = 'L' | 'M';

// Capacities & EC codewords table for Versions 1..25 (L and M)
// Entry: [totalDataCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2]
const VERSION_TABLE: Record<ECLevel, Array<[number, number, number, number, number, number]>> = {
  L: [
    [0, 0, 0, 0, 0, 0],
    [19, 7, 1, 19, 0, 0],
    [34, 10, 1, 34, 0, 0],
    [55, 15, 1, 55, 0, 0],
    [80, 20, 1, 80, 0, 0],
    [108, 26, 1, 108, 0, 0],
    [136, 18, 2, 68, 0, 0],
    [156, 20, 2, 78, 0, 0],
    [194, 24, 2, 97, 0, 0],
    [232, 30, 2, 116, 0, 0],
    [274, 18, 2, 68, 2, 69],
    [324, 20, 4, 81, 0, 0],
    [370, 24, 2, 92, 2, 93],
    [428, 26, 4, 107, 0, 0],
    [461, 30, 3, 115, 1, 116],
    [523, 22, 5, 87, 1, 88],
    [589, 24, 5, 98, 1, 99],
    [647, 28, 1, 107, 5, 108],
    [721, 30, 5, 120, 1, 121],
    [795, 28, 3, 113, 4, 114],
    [861, 28, 3, 107, 5, 108],
    [932, 28, 4, 116, 4, 117],
    [1006, 28, 2, 111, 7, 112],
    [1094, 30, 4, 121, 5, 122],
    [1174, 30, 6, 117, 4, 118],
    [1276, 26, 8, 106, 4, 107],
  ],
  M: [
    [0, 0, 0, 0, 0, 0],
    [16, 10, 1, 16, 0, 0],
    [28, 16, 1, 28, 0, 0],
    [44, 26, 1, 44, 0, 0],
    [64, 18, 2, 32, 0, 0],
    [86, 24, 2, 43, 0, 0],
    [108, 16, 4, 27, 0, 0],
    [124, 18, 4, 31, 0, 0],
    [154, 22, 2, 38, 2, 39],
    [182, 22, 3, 36, 2, 37],
    [216, 26, 4, 43, 1, 44],
    [254, 30, 1, 50, 4, 51],
    [290, 22, 6, 36, 2, 37],
    [334, 22, 8, 37, 1, 38],
    [365, 24, 4, 40, 5, 41],
    [415, 24, 5, 41, 5, 42],
    [453, 28, 7, 45, 3, 46],
    [507, 28, 10, 46, 1, 47],
    [563, 26, 9, 43, 4, 44],
    [627, 26, 3, 44, 11, 45],
    [669, 26, 3, 41, 13, 42],
    [714, 26, 17, 42, 0, 0],
    [782, 28, 17, 46, 0, 0],
    [860, 28, 4, 47, 14, 48],
    [914, 28, 6, 45, 14, 46],
    [1000, 28, 8, 47, 13, 48],
  ],
};

const ALIGNMENT_PATTERNS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
];

// GF(256) arithmetic for Reed-Solomon
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

export function generateQRMatrix(text: string, preferredLevel: ECLevel = 'M'): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let level: ECLevel = preferredLevel;
  let version = 1;

  const findVersion = (lvl: ECLevel): number => {
    for (let v = 1; v <= 25; v++) {
      const totalData = VERSION_TABLE[lvl][v][0];
      const lenBits = v <= 9 ? 8 : 16;
      const neededBytes = Math.ceil((4 + lenBits + bytes.length * 8) / 8);
      if (neededBytes <= totalData) return v;
    }
    return -1;
  };

  version = findVersion(level);
  if (version === -1 && level === 'M') {
    level = 'L';
    version = findVersion('L');
  }
  if (version === -1) {
    throw new Error('数据量超出二维码容量上限，请改用 .gkmix 工程文件分享');
  }

  const [totalData, ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] = VERSION_TABLE[level][version];
  const bitBuf: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuf.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator (0100)
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8);
  }

  const maxBits = totalData * 8;
  const terminator = Math.min(4, maxBits - bitBuf.length);
  pushBits(0, terminator);
  while (bitBuf.length % 8 !== 0) bitBuf.push(0);

  const dataWords = new Uint8Array(totalData);
  for (let i = 0; i < bitBuf.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bitBuf[i * 8 + j];
    dataWords[i] = b;
  }
  let padToggle = true;
  for (let i = bitBuf.length / 8; i < totalData; i++) {
    dataWords[i] = padToggle ? 0xec : 0x11;
    padToggle = !padToggle;
  }

  // Split into blocks and compute RS error correction
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; i < g1Blocks; i++) {
    const blk = dataWords.slice(offset, offset + g1Data);
    offset += g1Data;
    dataBlocks.push(blk);
    ecBlocks.push(rsEncode(blk, ecPerBlock));
  }
  for (let i = 0; i < g2Blocks; i++) {
    const blk = dataWords.slice(offset, offset + g2Data);
    offset += g2Data;
    dataBlocks.push(blk);
    ecBlocks.push(rsEncode(blk, ecPerBlock));
  }

  const interleaved: number[] = [];
  const maxDataLen = Math.max(g1Data, g2Data);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) interleaved.push(blk[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const blk of ecBlocks) {
      if (i < blk.length) interleaved.push(blk[i]);
    }
  }

  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (x: number, y: number, dark: boolean) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      modules[y][x] = dark;
      isFunc[y][x] = true;
    }
  };

  // Finder patterns + separators
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunctionModule(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // Timing patterns
  for (let i = 0; i < size; i++) {
    if (!isFunc[6][i]) setFunctionModule(i, 6, i % 2 === 0);
    if (!isFunc[i][6]) setFunctionModule(6, i, i % 2 === 0);
  }

  // Alignment patterns
  const alignCoords = ALIGNMENT_PATTERNS[version];
  for (const cy of alignCoords) {
    for (const cx of alignCoords) {
      if (
        (cx === 6 && cy === 6) ||
        (cx === 6 && cy === size - 7) ||
        (cx === size - 7 && cy === 6)
      ) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Reserve format info & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunctionModule(8, i, false);
      setFunctionModule(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunctionModule(size - 1 - i, 8, false);
    setFunctionModule(8, size - 1 - i, false);
  }
  setFunctionModule(8, size - 8, true);

  // Version info for version >= 7
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) {
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    }
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(a, b, bit);
      setFunctionModule(b, a, bit);
    }
  }

  // Place data bits in zigzag
  let bitIdx = 0;
  const totalBits = interleaved.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunc[y][x] && bitIdx < totalBits) {
          const b = (interleaved[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
          modules[y][x] = b !== 0;
          bitIdx++;
        }
      }
    }
  }

  // Apply Mask 0 ((x + y) % 2 === 0) and write format bits
  const maskPattern = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFunc[y][x] && (x + y) % 2 === 0) {
        modules[y][x] = !modules[y][x];
      }
    }
  }

  const ecFormatBits = level === 'L' ? 1 : 0; // L = 01, M = 00
  const dataFormat = (ecFormatBits << 3) | maskPattern;
  let rem = dataFormat;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  const formatBits = ((dataFormat << 10) | rem) ^ 0x5412;

  for (let i = 0; i <= 5; i++) setFunctionModule(8, i, ((formatBits >>> i) & 1) !== 0);
  setFunctionModule(8, 7, ((formatBits >>> 6) & 1) !== 0);
  setFunctionModule(8, 8, ((formatBits >>> 7) & 1) !== 0);
  setFunctionModule(7, 8, ((formatBits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, ((formatBits >>> i) & 1) !== 0);

  for (let i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, ((formatBits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, ((formatBits >>> i) & 1) !== 0);
  setFunctionModule(8, size - 8, true);

  return modules;
}

/**
 * Renders a crisp QR code onto an HTMLCanvasElement or returns a DataURL with an 8px quiet zone.
 */
export function renderQRCodeToDataUrl(
  text: string,
  sizePx = 220,
  quietZonePx = 10,
  level: ECLevel = 'M'
): string {
  const matrix = generateQRMatrix(text, level);
  const count = matrix.length;
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, sizePx, sizePx);

  const innerSize = sizePx - quietZonePx * 2;
  const cell = innerSize / count;

  ctx.fillStyle = '#0B0D13';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        const x = Math.floor(quietZonePx + c * cell);
        const y = Math.floor(quietZonePx + r * cell);
        const w = Math.ceil(quietZonePx + (c + 1) * cell) - x;
        const h = Math.ceil(quietZonePx + (r + 1) * cell) - y;
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

// ==========================================
// PNG tEXt Chunk Metadata Embedder & Reader (for 100% lossless Web poster scan even without BarcodeDetector)
// ==========================================

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export async function embedPayloadInPngDataUrl(pngDataUrl: string, payload: string): Promise<string> {
  try {
    const res = await fetch(pngDataUrl);
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Check PNG signature
    if (bytes.length < 33 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return pngDataUrl;

    const keyBytes = new TextEncoder().encode('gkm1');
    const valBytes = new TextEncoder().encode(payload);
    const chunkData = new Uint8Array(keyBytes.length + 1 + valBytes.length);
    chunkData.set(keyBytes, 0);
    chunkData[keyBytes.length] = 0;
    chunkData.set(valBytes, keyBytes.length + 1);

    const chunkType = new TextEncoder().encode('tEXt');
    const crcInput = new Uint8Array(4 + chunkData.length);
    crcInput.set(chunkType, 0);
    crcInput.set(chunkData, 4);
    const crc = crc32(crcInput);

    const fullChunk = new Uint8Array(12 + chunkData.length);
    const dv = new DataView(fullChunk.buffer);
    dv.setUint32(0, chunkData.length, false);
    fullChunk.set(chunkType, 4);
    fullChunk.set(chunkData, 8);
    dv.setUint32(8 + chunkData.length, crc, false);

    // Insert right before IEND (last 12 bytes)
    const iendOffset = bytes.length - 12;
    const out = new Uint8Array(bytes.length + fullChunk.length);
    out.set(bytes.subarray(0, iendOffset), 0);
    out.set(fullChunk, iendOffset);
    out.set(bytes.subarray(iendOffset), iendOffset + fullChunk.length);

    const blob = new Blob([out], { type: 'image/png' });
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || pngDataUrl);
      reader.readAsDataURL(blob);
    });
  } catch {
    return pngDataUrl;
  }
}

export function extractPayloadFromPngBytes(bytes: Uint8Array): string | null {
  try {
    if (bytes.length < 33 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const len = dv.getUint32(offset, false);
      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
      if (type === 'tEXt' && offset + 8 + len <= bytes.length) {
        const data = bytes.subarray(offset + 8, offset + 8 + len);
        const nul = data.indexOf(0);
        if (nul > 0) {
          const key = new TextDecoder().decode(data.subarray(0, nul));
          const val = new TextDecoder().decode(data.subarray(nul + 1));
          if (key === 'gkm1' || val.startsWith('gkm1:')) {
            return val;
          }
        }
      }
      offset += 12 + len;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Scans a poster File or DataURL for a `gkm1:` QR code using:
 * 1. Embedded PNG tEXt chunk (instant, works on all browsers)
 * 2. Browser native BarcodeDetector API (on full image + cropped bottom-right QR region)
 */
export async function detectQRFromImageFile(fileOrDataUrl: File | string): Promise<string | null> {
  let bytes: Uint8Array | null = null;
  let imgUrl = '';

  if (typeof fileOrDataUrl === 'string') {
    imgUrl = fileOrDataUrl;
    try {
      const res = await fetch(fileOrDataUrl);
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch {
      // ignore
    }
  } else {
    bytes = new Uint8Array(await fileOrDataUrl.arrayBuffer());
    imgUrl = URL.createObjectURL(fileOrDataUrl);
  }

  if (bytes) {
    const chunkPayload = extractPayloadFromPngBytes(bytes);
    if (chunkPayload && chunkPayload.startsWith('gkm1:')) {
      if (typeof fileOrDataUrl !== 'string') URL.revokeObjectURL(imgUrl);
      return chunkPayload;
    }
  }

  // Try BarcodeDetector if supported by the browser (Chrome, Edge, Android WebView, newer Safari)
  const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
  if (BarcodeDetectorCtor) {
    try {
      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = imgUrl;
      });

      const direct = await detector.detect(img);
      for (const item of direct) {
        if (item.rawValue && String(item.rawValue).startsWith('gkm1:')) {
          if (typeof fileOrDataUrl !== 'string') URL.revokeObjectURL(imgUrl);
          return String(item.rawValue);
        }
      }

      // Also try bottom-half crop where the QR code resides on the poster
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = img.naturalWidth;
      cropCanvas.height = Math.round(img.naturalHeight * 0.5);
      const ctx = cropCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          img,
          0,
          Math.round(img.naturalHeight * 0.5),
          img.naturalWidth,
          cropCanvas.height,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height
        );
        const croppedHits = await detector.detect(cropCanvas);
        for (const item of croppedHits) {
          if (item.rawValue && String(item.rawValue).startsWith('gkm1:')) {
            if (typeof fileOrDataUrl !== 'string') URL.revokeObjectURL(imgUrl);
            return String(item.rawValue);
          }
        }
      }
    } catch (err) {
      console.warn('BarcodeDetector failed:', err);
    }
  }

  if (typeof fileOrDataUrl !== 'string') URL.revokeObjectURL(imgUrl);
  return null;
}
