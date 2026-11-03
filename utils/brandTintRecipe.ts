/**
 * ============================================================================
 * GK PAINT MIXER — ENCRYPTED CORE ALGORITHM MODULE (brandTintRecipe.ts)
 * ============================================================================
 * License: PolyForm Noncommercial License 1.0.0 (see /LICENSE)
 * Required Notice: Copyright (c) 2025-2026 HDINEVER / HDIN Studio
 *
 * NOTICE: This core algorithm module is protected via stream-cipher payload
 * encryption to prevent unauthorized commercial plagiarism while supporting
 * 100% offline client-side execution. Commercial use is strictly prohibited.
 * ============================================================================
 */
import type { CatalogPaint, Language } from "../types";
import * as _dep_ciede from "./ciede2000";
import * as _dep_catalog from "./paintCatalog";
import * as _dep_edition from "./brandEdition";

export interface BrandTintModifierItem {
  name: string; // e.g. "纯白 / 光泽白 (White)"
  shortName: string; // e.g. "白"
  hex: string; // e.g. "#F8FAFC"
  pct: number; // e.g. 10
  drops: number; // e.g. 1
  roleLabel: string; // e.g. "提亮明度 +9%L"
}

export interface BrandTintRecipe {
  targetHex: string;
  basePaint: {
    id: string;
    brand: string;
    brandZh: string;
    code: string;
    name: string;
    hex: string;
  };
  deltaE: number;
  similarityPct: number;
  deltaL: number; // Target L% - Base L%
  deltaS: number; // Target S% - Base S%
  isDirectMatch: boolean; // True when deltaE <= 2.2
  basePct: number; // 75 ~ 100
  baseDrops: number; // Out of 10 total drops (e.g. 8.5, 9, 10)
  modifier: BrandTintModifierItem | null;
  effectTag: string; // e.g. "+9%L 提亮" or "直喷"
  compactPillText: string; // e.g. "🔧 微调：NDL033 (90%) + 白 (10%) · [+9%L 提亮]"
  shortFormulaText: string; // e.g. "NDL033 (90%) + 白 (10%)"
  spokenTip: string; // Beginner-friendly natural language tip
}

const __GK_CORE_CIPHER_PAYLOAD__ = [
  "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"
].join("");

const _gkDeps: Record<string, any> = {
  "./ciede2000": _dep_ciede,
  "./paintCatalog": _dep_catalog,
  "./brandEdition": _dep_edition,
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

export const computeBrandTintRecipe: any = _gkCore.computeBrandTintRecipe;
export const findTopBrandMatchesForHex: any = _gkCore.findTopBrandMatchesForHex;
