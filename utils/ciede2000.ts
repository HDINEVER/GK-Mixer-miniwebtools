/**
 * ============================================================================
 * GK PAINT MIXER — ENCRYPTED CORE ALGORITHM MODULE (ciede2000.ts)
 * ============================================================================
 * License: PolyForm Noncommercial License 1.0.0 (see /LICENSE)
 * Required Notice: Copyright (c) 2025-2026 HDINEVER / HDIN Studio
 *
 * NOTICE: This core algorithm module is protected via stream-cipher payload
 * encryption to prevent unauthorized commercial plagiarism while supporting
 * 100% offline client-side execution. Commercial use is strictly prohibited.
 * ============================================================================
 */

export interface Lab {
  l: number;
  a: number;
  b: number;
}

const __GK_CORE_CIPHER_PAYLOAD__ = [
  "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",
  "CGo0+GQ1o0s="
].join("");

const _gkDeps: Record<string, any> = {

};

function _decodeGkCorePayload(b64: string): Record<string, any> {
  const key = "GKMixer::PolyForm-Noncommercial-1.0.0::CoreCipherKey::2026#HDINEVER";
  const binStr = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const len = binStr.length;
  const out = new Uint8Array(len);
  let state = 0x5a3c9e17;
  for (let i = 0; i < len; i++) {
    const k = key.charCodeAt(i % key.length);
    state = (Math.imul(state ^ k, 0x01000193) + (i & 0xff)) >>> 0;
    const mask = ((state >>> 16) ^ state ^ k ^ (i * 31)) & 0xff;
    out[i] = (binStr.charCodeAt(i) & 0xff) ^ mask;
  }
  const code = new TextDecoder("utf-8").decode(out);
  const mod = { exports: {} as Record<string, any> };
  const req = (id: string) => {
    if (id in _gkDeps) return _gkDeps[id];
    throw new Error("Unknown core dependency: " + id);
  };
  const fn = new Function("module", "exports", "require", code);
  fn(mod, mod.exports, req);
  return mod.exports;
}

const _gkCore = _decodeGkCorePayload(__GK_CORE_CIPHER_PAYLOAD__);

export const deltaE2000: any = _gkCore.deltaE2000;
export const labFromHex: any = _gkCore.labFromHex;
export const labFromRgb: any = _gkCore.labFromRgb;
export const rgbFromHex: any = _gkCore.rgbFromHex;
