/**
 * GK-Mixer AI 涂装与模拟上色精修网关 + 轻量通行证点数账本
 * 同时兼容 Cloudflare Pages Functions (Web Crypto / Fetch) 与本地 Vite Node 中间件。
 */

export const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
export const DEFAULT_ARK_MODEL = "doubao-seedream-5-5-261028";
export const FREE_TRIAL_CREDITS = 20;

export const OFFICIAL_ARK_MODELS = {
  "seedream-5.5": {
    key: "seedream-5.5",
    defaultModelId: "doubao-seedream-5-5-261028",
    label: "Seedream 5.5",
    cost1k: 4,
    cost2k: 6,
    supportsTransparent: true,
  },
  "seedream-5.0-pro": {
    key: "seedream-5.0-pro",
    defaultModelId: "doubao-seedream-5-0-pro-260628",
    label: "Seedream 5.0 Pro",
    cost1k: 8,
    cost2k: 12,
    supportsTransparent: false,
  },
};

export const COST_PER_RENDER_1K = OFFICIAL_ARK_MODELS["seedream-5.5"].cost1k;
export const COST_PER_RENDER_2K = OFFICIAL_ARK_MODELS["seedream-5.5"].cost2k;
export const COST_PER_RENDER = COST_PER_RENDER_2K;

export function resolveOfficialRenderSpec(rawModelKey, rawSize, env) {
  const normalizedModel = String(rawModelKey || "seedream-5.5").trim().toLowerCase();
  const isPro50 = normalizedModel.includes("5-0") || normalizedModel.includes("5.0");
  const modelMeta = isPro50
    ? OFFICIAL_ARK_MODELS["seedream-5.0-pro"]
    : OFFICIAL_ARK_MODELS["seedream-5.5"];

  let modelId = modelMeta.defaultModelId;
  if (modelMeta.key === "seedream-5.5") {
    modelId =
      (env && env.ARK_MODEL_55) ||
      (env && env.ARK_SEEDREAM_MODEL && /5-5|5\.5/i.test(env.ARK_SEEDREAM_MODEL)
        ? env.ARK_SEEDREAM_MODEL
        : modelMeta.defaultModelId);
  } else {
    modelId = (env && env.ARK_MODEL_50_PRO) || modelMeta.defaultModelId;
  }

  const normalizedSize = String(rawSize || "2K").trim().toUpperCase();
  const is1K = normalizedSize === "1K" || normalizedSize === "1080P";
  return {
    key: modelMeta.key,
    modelId,
    modelLabel: modelMeta.label,
    size: is1K ? "1K" : "2K",
    sizeLabel: is1K ? "1080p" : "2K",
    cost: is1K ? modelMeta.cost1k : modelMeta.cost2k,
    supportsTransparent: modelMeta.supportsTransparent,
  };
}

export function resolveRenderQuality(rawSize) {
  const normalized = String(rawSize || "2K").trim().toUpperCase();
  if (normalized === "1K" || normalized === "1080P") {
    return { size: "1K", cost: COST_PER_RENDER_1K, label: "1080p" };
  }
  return { size: "2K", cost: COST_PER_RENDER_2K, label: "2K" };
}

// Local / fallback in-memory store when Cloudflare KV (AI_CREDITS_KV) is not yet bound
const memoryStore = new Map();

function getCrypto() {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  throw new Error("Web Crypto API unavailable in current runtime");
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(b64) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export async function hmacHex(secret, message) {
  const cryptoObj = getCrypto();
  const enc = new TextEncoder();
  const key = await cryptoObj.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await cryptoObj.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(new Uint8Array(sig)).toUpperCase();
}

async function sha256Short(text) {
  const cryptoObj = getCrypto();
  const digest = await cryptoObj.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return bytesToHex(new Uint8Array(digest)).slice(0, 16);
}

// ==========================================
// KV / Memory Storage Abstraction
// ==========================================
async function storeGetJson(env, key) {
  const kv = env && env.AI_CREDITS_KV;
  if (kv && typeof kv.get === "function") {
    const raw = await kv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return memoryStore.get(key) || null;
}

async function storePutJson(env, key, value, ttlSeconds) {
  const kv = env && env.AI_CREDITS_KV;
  if (kv && typeof kv.put === "function") {
    const opts = ttlSeconds ? { expirationTtl: ttlSeconds } : undefined;
    await kv.put(key, JSON.stringify(value), opts);
    return;
  }
  memoryStore.set(key, value);
}

export function normalizePasskey(raw) {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  if (!/^GKM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export async function getOrInitWallet(env, passkey, clientIp = "unknown") {
  const validKey = normalizePasskey(passkey);
  if (!validKey) {
    throw new Error("无效的通行证密钥格式");
  }
  const storageKey = `wallet:${validKey}`;
  const existing = await storeGetJson(env, storageKey);
  if (existing && typeof existing.credits === "number") {
    return existing;
  }

  // Anti-abuse check per IP for initial free trial grant
  let initialCredits = FREE_TRIAL_CREDITS;
  if (clientIp && clientIp !== "unknown" && clientIp !== "127.0.0.1") {
    const ipHash = await sha256Short(`trial-ip:${clientIp}`);
    const ipKey = `trial_ip:${ipHash}`;
    const ipRecord = (await storeGetJson(env, ipKey)) || { count: 0 };
    if (ipRecord.count >= 2) {
      initialCredits = 0;
    } else {
      await storePutJson(
        env,
        ipKey,
        { count: ipRecord.count + 1, updatedAt: Date.now() },
        60 * 60 * 24 * 30
      );
    }
  }

  const wallet = {
    passkey: validKey,
    credits: initialCredits,
    totalPurchased: 0,
    totalUsed: 0,
    trialGranted: initialCredits > 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await storePutJson(env, storageKey, wallet);
  return wallet;
}

export async function deductWalletCredits(env, passkey, amount, clientIp) {
  const wallet = await getOrInitWallet(env, passkey, clientIp);
  if (wallet.credits < amount) {
    return { ok: false, wallet };
  }
  const updated = {
    ...wallet,
    credits: wallet.credits - amount,
    totalUsed: (wallet.totalUsed || 0) + amount,
    updatedAt: Date.now(),
  };
  await storePutJson(env, `wallet:${wallet.passkey}`, updated);
  return { ok: true, wallet: updated };
}

export async function refundWalletCredits(env, passkey, amount) {
  const validKey = normalizePasskey(passkey);
  if (!validKey) return null;
  const existing = await storeGetJson(env, `wallet:${validKey}`);
  if (!existing) return null;
  const updated = {
    ...existing,
    credits: existing.credits + amount,
    totalUsed: Math.max(0, (existing.totalUsed || 0) - amount),
    updatedAt: Date.now(),
  };
  await storePutJson(env, `wallet:${validKey}`, updated);
  return updated;
}

/**
 * 核销加密签名充值码：格式 GKM-<POINTS>-<NONCE8>-<SIG10>
 * 使用 scripts/generate-redeem-codes.mjs 与相同的 CREDITS_SIGNING_SECRET 离线批量签发，无需预写数据库！
 */
export async function redeemSignedCode(env, passkey, rawCode, clientIp) {
  const secret = (env && env.CREDITS_SIGNING_SECRET) || "";
  if (!secret) {
    throw new Error("服务端尚未配置 CREDITS_SIGNING_SECRET 充值签名密钥");
  }

  const code = String(rawCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const match = code.match(/^GKM-(\d{1,6})-([A-Z0-9]{6,12})-([A-F0-9]{10,16})$/);
  if (!match) {
    throw new Error("兑换码格式不正确（示例：GKM-100-8F3K92AB-E49C10B27A）");
  }

  const points = parseInt(match[1], 10);
  const nonce = match[2];
  const providedSig = match[3];

  if (!Number.isFinite(points) || points <= 0 || points > 100000) {
    throw new Error("兑换码面额无效");
  }

  const expectedFullSig = await hmacHex(secret, `GKM-CDK:v1:${points}:${nonce}`);
  const expectedSig = expectedFullSig.slice(0, providedSig.length);
  if (expectedSig !== providedSig) {
    throw new Error("兑换码无效或校验未通过，请检查是否输错字符");
  }

  const usedKey = `cdk_used:${nonce}`;
  const alreadyUsed = await storeGetJson(env, usedKey);
  if (alreadyUsed) {
    throw new Error("该兑换码已被使用过，不可重复核销");
  }

  const wallet = await getOrInitWallet(env, passkey, clientIp);
  await storePutJson(env, usedKey, {
    nonce,
    points,
    redeemedBy: wallet.passkey,
    redeemedAt: Date.now(),
  });

  const updatedWallet = {
    ...wallet,
    credits: wallet.credits + points,
    totalPurchased: (wallet.totalPurchased || 0) + points,
    updatedAt: Date.now(),
  };
  await storePutJson(env, `wallet:${wallet.passkey}`, updatedWallet);
  return { addedPoints: points, wallet: updatedWallet };
}

// ==========================================
// Helper: Ensure image result is returned as Data URI (zero browser CORS taint)
// ==========================================
async function fetchUrlAsDataUri(imageUrl) {
  const resp = await fetch(imageUrl);
  if (!resp.ok) {
    throw new Error(`拉取生成结果图片失败 (HTTP ${resp.status})`);
  }
  const contentType = resp.headers.get("content-type") || "image/png";
  const mime = contentType.split(";")[0].trim() || "image/png";
  const buf = await resp.arrayBuffer();
  return `data:${mime};base64,${arrayBufferToBase64(buf)}`;
}

function parseDataUri(dataUri) {
  const m = String(dataUri || "").match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!m) {
    throw new Error("输入图片需为有效的 Base64 Data URI 格式");
  }
  const rawMime = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
  return {
    mimeType: rawMime,
    base64: m[2],
    normalizedDataUri: `data:${rawMime};base64,${m[2]}`,
  };
}

// ==========================================
// Provider 1: 火山引擎方舟 Doubao Seedream / SeedEdit
// ==========================================
export async function callVolcengineSeedream({
  apiKey,
  baseUrl = DEFAULT_ARK_BASE_URL,
  model = DEFAULT_ARK_MODEL,
  prompt,
  images = [],
  size = "2K",
  background = "auto",
  outputFormat,
}) {
  if (!apiKey) {
    throw new Error("未配置火山引擎 ARK_API_KEY");
  }
  const cleanBase = String(baseUrl || DEFAULT_ARK_BASE_URL).replace(/\/+$/, "");
  const endpoint = cleanBase.endsWith("/images/generations")
    ? cleanBase
    : `${cleanBase}/images/generations`;

  const targetModel = model || DEFAULT_ARK_MODEL;
  const wantsTransparent = background === "transparent";
  const normalizedImages = images.map((img) => parseDataUri(img).normalizedDataUri);

  const buildPayload = (imgField, sizeValue, includeBgOpts = true) => {
    const body = {
      model: targetModel,
      prompt,
      response_format: "url",
      size: sizeValue,
      stream: false,
      watermark: false,
    };
    if (includeBgOpts) {
      if (wantsTransparent) {
        body.output_format = "png";
        body.background = "transparent";
      } else if (outputFormat === "png" || outputFormat === "jpeg") {
        body.output_format = outputFormat;
      }
    }
    if (imgField !== undefined) {
      body.image = imgField;
    }
    return body;
  };

  const primaryImageParam =
    normalizedImages.length === 0
      ? undefined
      : normalizedImages.length === 1
      ? normalizedImages[0]
      : normalizedImages;

  let resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildPayload(primaryImageParam, size || "2K", true)),
  });

  // Fallback for older Seedream / SeedEdit models
  if (!resp.ok && resp.status === 400) {
    const errText = await resp.text();
    const hasBgOpts = wantsTransparent || outputFormat === "png" || outputFormat === "jpeg";
    if (hasBgOpts && (errText.includes("background") || errText.includes("output_format"))) {
      // Retry cleanly without 5.5-only params while preserving size and multi-image input
      const cleanRetryResp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildPayload(primaryImageParam, size || "2K", false)),
      });
      if (cleanRetryResp.ok) {
        resp = cleanRetryResp;
      }
    }
    if (!resp.ok) {
      const fallbackBody = {
        model: targetModel,
        prompt,
        response_format: "b64_json",
        watermark: false,
      };
      if (normalizedImages.length > 0) {
        // Try last image (simulated colored or primary input) if model only accepts single string image
        fallbackBody.image =
          errText.includes("image") && normalizedImages.length > 1
            ? normalizedImages[normalizedImages.length - 1]
            : primaryImageParam;
      }
      if (!errText.includes("size")) {
        fallbackBody.size = "adaptive";
      }
      const retryResp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(fallbackBody),
      });
      if (retryResp.ok) {
        resp = retryResp;
      } else {
        let msg = errText;
        try {
          const parsed = JSON.parse(errText);
          msg = parsed?.error?.message || msg;
        } catch {}
        throw new Error(`Seedream 接口返回错误 (400): ${msg}`);
      }
    }
  }

  if (!resp.ok) {
    const errRaw = await resp.text();
    let msg = errRaw;
    try {
      const parsed = JSON.parse(errRaw);
      msg = parsed?.error?.message || msg;
    } catch {}
    throw new Error(`Seedream 生成失败 (HTTP ${resp.status}): ${msg}`);
  }

  const json = await resp.json();
  const item = Array.isArray(json?.data) ? json.data[0] : null;
  if (!item) {
    throw new Error("Seedream 未返回有效图像数据");
  }
  const outMime = wantsTransparent || outputFormat === "png" ? "image/png" : "image/jpeg";
  if (item.b64_json) {
    const cleanB64 = String(item.b64_json).replace(/^data:image\/[^;]+;base64,/, "");
    return {
      imageDataUrl: `data:${outMime};base64,${cleanB64}`,
      modelUsed: targetModel,
    };
  }
  if (item.url) {
    const dataUrl = await fetchUrlAsDataUri(item.url);
    return {
      imageDataUrl: dataUrl,
      modelUsed: targetModel,
    };
  }
  throw new Error("Seedream 返回格式无法解析");
}

// ==========================================
// Provider 2: Google Gemini Image Edit (BYOK)
// ==========================================
export async function callGeminiImageEdit({
  apiKey,
  baseUrl = "https://generativelanguage.googleapis.com/v1beta",
  model = "gemini-2.5-flash-image",
  prompt,
  images = [],
}) {
  if (!apiKey) throw new Error("请输入 Google Gemini API Key");
  const cleanBase = String(baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const targetModel = model || "gemini-2.5-flash-image";
  const url = `${cleanBase}/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const parts = images.map((img) => {
    const parsed = parseDataUri(img);
    return {
      inlineData: {
        mimeType: parsed.mimeType,
        data: parsed.base64,
      },
    };
  });
  parts.push({ text: prompt });

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!resp.ok) {
    const errRaw = await resp.text();
    let msg = errRaw;
    try {
      msg = JSON.parse(errRaw)?.error?.message || msg;
    } catch {}
    throw new Error(`Gemini 接口错误 (HTTP ${resp.status}): ${msg}`);
  }

  const json = await resp.json();
  const candidates = json?.candidates || [];
  for (const cand of candidates) {
    const cParts = cand?.content?.parts || [];
    for (const p of cParts) {
      const inline = p.inlineData || p.inline_data;
      if (inline?.data) {
        const mime = inline.mimeType || inline.mime_type || "image/png";
        return {
          imageDataUrl: `data:${mime};base64,${inline.data}`,
          modelUsed: targetModel,
        };
      }
    }
  }
  throw new Error("Gemini 未返回生成图像（请确认模型支持图像输出，如 gemini-2.5-flash-image）");
}

// ==========================================
// Provider 3: OpenAI (gpt-image-1 / gpt-image-1.5) & OpenAI-Compatible Gateways (Grok / 中转站)
// ==========================================
export async function callOpenAiCompatibleImage({
  apiKey,
  baseUrl = "https://api.openai.com/v1",
  model = "gpt-image-1",
  prompt,
  images = [],
}) {
  if (!apiKey) throw new Error("请输入 API Key");
  const cleanBase = String(baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const targetModel = model || "gpt-image-1";

  // If reference images exist and model is gpt-image*, use standard multipart /images/edits
  const isGptImage = /gpt-image/i.test(targetModel);
  if (images.length > 0 && isGptImage) {
    const form = new FormData();
    form.append("model", targetModel);
    form.append("prompt", prompt);
    images.forEach((img, idx) => {
      const parsed = parseDataUri(img);
      const bytes = base64ToUint8Array(parsed.base64);
      const ext = parsed.mimeType.includes("png") ? "png" : "jpg";
      const blob = new Blob([bytes], { type: parsed.mimeType });
      form.append(images.length > 1 ? "image[]" : "image", blob, `ref_${idx}.${ext}`);
    });

    const resp = await fetch(`${cleanBase}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!resp.ok) {
      const errRaw = await resp.text();
      let msg = errRaw;
      try {
        msg = JSON.parse(errRaw)?.error?.message || msg;
      } catch {}
      throw new Error(`OpenAI 图像编辑失败 (HTTP ${resp.status}): ${msg}`);
    }

    const json = await resp.json();
    const item = json?.data?.[0];
    if (item?.b64_json) {
      return { imageDataUrl: `data:image/png;base64,${item.b64_json}`, modelUsed: targetModel };
    }
    if (item?.url) {
      return { imageDataUrl: await fetchUrlAsDataUri(item.url), modelUsed: targetModel };
    }
    throw new Error("OpenAI 未返回有效图片");
  }

  // Generic JSON /images/generations or /images/edits (for xAI Grok, SiliconFlow, NewAPI, etc.)
  const isXai = cleanBase.includes("api.x.ai") || /grok/i.test(targetModel);
  const endpoint =
    images.length > 0 && isXai
      ? `${cleanBase}/images/edits`
      : `${cleanBase}/images/generations`;

  const payload = {
    model: targetModel,
    prompt,
    response_format: "b64_json",
  };
  if (images.length > 0) {
    const normalized = images.map((img) => parseDataUri(img).normalizedDataUri);
    payload.image = normalized.length === 1 ? normalized[0] : normalized;
    if (isXai) {
      payload.image_url = normalized[normalized.length - 1];
      delete payload.image;
    }
  }

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errRaw = await resp.text();
    let msg = errRaw;
    try {
      msg = JSON.parse(errRaw)?.error?.message || msg;
    } catch {}
    throw new Error(`自定义图像接口错误 (HTTP ${resp.status}): ${msg}`);
  }

  const json = await resp.json();
  const item = json?.data?.[0];
  if (item?.b64_json) {
    const cleanB64 = String(item.b64_json).replace(/^data:image\/[^;]+;base64,/, "");
    return { imageDataUrl: `data:image/png;base64,${cleanB64}`, modelUsed: targetModel };
  }
  if (item?.url) {
    return { imageDataUrl: await fetchUrlAsDataUri(item.url), modelUsed: targetModel };
  }
  throw new Error("接口未返回有效图片数据");
}

// ==========================================
// Unified Request Handlers (used by Cloudflare Pages Functions & Vite Dev Server)
// ==========================================
const SAFE_PRESET_STYLE_REF_RE = /^\/ai-style-refs\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i;

export function assemblePromptFromBlocks(promptBlocks, fallbackPrompt, styleRefAttached) {
  if (Array.isArray(promptBlocks) && promptBlocks.length > 0) {
    const parts = [];
    for (const block of promptBlocks) {
      if (!block || typeof block.text !== "string") continue;
      if (block.requiresStyleRef && !styleRefAttached) continue;
      const trimmed = block.text.trim();
      if (trimmed) parts.push(trimmed);
    }
    if (parts.length > 0) {
      return parts.join(" ");
    }
  }
  return String(fallbackPrompt || "").trim();
}

export async function processWalletAction(env, body, clientIp = "unknown") {
  const action = body?.action || "status";
  const passkey = body?.passkey;
  const officialReady = Boolean(env && env.ARK_API_KEY);
  const kvReady = Boolean(env && env.AI_CREDITS_KV);
  const pricingMatrix = {
    "seedream-5.5": {
      cost1k: OFFICIAL_ARK_MODELS["seedream-5.5"].cost1k,
      cost2k: OFFICIAL_ARK_MODELS["seedream-5.5"].cost2k,
      supportsTransparent: OFFICIAL_ARK_MODELS["seedream-5.5"].supportsTransparent,
    },
    "seedream-5.0-pro": {
      cost1k: OFFICIAL_ARK_MODELS["seedream-5.0-pro"].cost1k,
      cost2k: OFFICIAL_ARK_MODELS["seedream-5.0-pro"].cost2k,
      supportsTransparent: OFFICIAL_ARK_MODELS["seedream-5.0-pro"].supportsTransparent,
    },
  };

  if (action === "status") {
    const wallet = await getOrInitWallet(env, passkey, clientIp);
    return {
      ok: true,
      officialReady,
      kvReady,
      costPerRender: COST_PER_RENDER_2K,
      costPerRender1k: COST_PER_RENDER_1K,
      costPerRender2k: COST_PER_RENDER_2K,
      pricingMatrix,
      wallet,
    };
  }

  if (action === "redeem") {
    const result = await redeemSignedCode(env, passkey, body?.code, clientIp);
    return {
      ok: true,
      officialReady,
      kvReady,
      costPerRender: COST_PER_RENDER_2K,
      costPerRender1k: COST_PER_RENDER_1K,
      costPerRender2k: COST_PER_RENDER_2K,
      pricingMatrix,
      addedPoints: result.addedPoints,
      wallet: result.wallet,
    };
  }

  throw new Error(`未知钱包操作: ${action}`);
}

export async function processAiRenderRequest(env, body, clientIp = "unknown", options = {}) {
  const channel = body?.channel === "byok" ? "byok" : "official";
  const quality = resolveRenderQuality(body?.size);
  const background = body?.background === "transparent" ? "transparent" : "auto";
  const outputFormat =
    background === "transparent"
      ? "png"
      : body?.outputFormat === "png" || body?.outputFormat === "jpeg"
      ? body.outputFormat
      : undefined;
  const rawPrompt = String(body?.prompt || "").trim();
  const images = Array.isArray(body?.images) ? body.images.filter(Boolean) : [];
  const isConnectivityTest = Boolean(body?.testOnly);

  // Server-side automatic attachment for preset style reference or user custom reference image
  const styleRefMode =
    body?.styleRefMode === "custom"
      ? "custom"
      : body?.styleRefMode === "preset"
      ? "preset"
      : "none";
  let styleRefAttached = false;
  const finalImages = [...images];

  if (styleRefMode === "custom") {
    const customImg = body?.customStyleRefImage;
    if (typeof customImg === "string" && customImg.startsWith("data:image")) {
      finalImages.push(customImg);
      styleRefAttached = true;
    }
  } else if (styleRefMode === "preset") {
    const refPath = String(body?.presetStyleRefPath || "").trim();
    if (SAFE_PRESET_STYLE_REF_RE.test(refPath) && typeof options?.loadStaticAsset === "function") {
      try {
        const asset = await options.loadStaticAsset(refPath);
        if (asset && asset.buffer && asset.buffer.byteLength > 0 && String(asset.mimeType || "").startsWith("image/")) {
          const cleanMime = asset.mimeType.split(";")[0].trim();
          finalImages.push(`data:${cleanMime};base64,${arrayBufferToBase64(asset.buffer)}`);
          styleRefAttached = true;
        }
      } catch {
        // Missing or unreadable preset ref photo degrades cleanly to prompt-only generation
      }
    }
  } else if (body?.hasStyleRefImage) {
    // Backward compatibility if a client already included style ref in images[]
    styleRefAttached = true;
  }

  const finalPrompt = assemblePromptFromBlocks(body?.promptBlocks, rawPrompt, styleRefAttached);

  if (!isConnectivityTest && !finalPrompt) {
    throw new Error("提示词不能为空");
  }
  if (!isConnectivityTest && finalImages.length === 0) {
    throw new Error("请至少提供一张模型底图");
  }

  // ------------------------------------------
  // Track A: BYOK (用户自带 API Key — 0 点数消耗，纯无状态透传)
  // ------------------------------------------
  if (channel === "byok") {
    const byok = body?.byok || {};
    const provider = byok.provider || "ark";
    const apiKey = String(byok.apiKey || "").trim();
    const baseUrl = String(byok.baseUrl || "").trim() || undefined;
    const model = String(byok.model || "").trim() || undefined;

    if (!apiKey) {
      throw new Error("请先填写你自己的 API Key");
    }

    if (isConnectivityTest) {
      // Lightweight 1x1 white pixel connectivity verification or minimal generation check
      const tinyPixel =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGP8//8/AzbAxIAXsAEA/38IA82t66cAAAAASUVORK5CYII=";
      const testPrompt = "保持原图，极简灰白方块模型测试";
      if (provider === "gemini") {
        await callGeminiImageEdit({ apiKey, baseUrl, model, prompt: testPrompt, images: [tinyPixel] });
      } else if (provider === "ark") {
        await callVolcengineSeedream({
          apiKey,
          baseUrl,
          model,
          prompt: testPrompt,
          images: [tinyPixel],
          size: "1K",
        });
      } else {
        await callOpenAiCompatibleImage({ apiKey, baseUrl, model, prompt: testPrompt, images: [] });
      }
      return { ok: true, tested: true, message: "API 连通性测试成功！" };
    }

    let result;
    if (provider === "ark") {
      result = await callVolcengineSeedream({
        apiKey,
        baseUrl,
        model,
        prompt: finalPrompt,
        images: finalImages,
        size: quality.size,
        background,
        outputFormat,
      });
    } else if (provider === "gemini") {
      result = await callGeminiImageEdit({
        apiKey,
        baseUrl,
        model,
        prompt: finalPrompt,
        images: finalImages,
      });
    } else {
      result = await callOpenAiCompatibleImage({
        apiKey,
        baseUrl,
        model,
        prompt: finalPrompt,
        images: finalImages,
      });
    }

    return {
      ok: true,
      channel: "byok",
      imageDataUrl: result.imageDataUrl,
      modelUsed: result.modelUsed,
      styleRefApplied: styleRefAttached,
    };
  }

  // ------------------------------------------
  // Track B: Official Seedream Channel (官方通道 — 扣减点数，失败自动退回)
  // ------------------------------------------
  const officialApiKey = env && env.ARK_API_KEY;
  if (!officialApiKey) {
    const err = new Error(
      "官方 Seedream 通道尚未在服务端配置密钥（你可先切换到「自带 API 免费用」模式立即使用）"
    );
    err.code = "OFFICIAL_NOT_CONFIGURED";
    throw err;
  }

  const spec = resolveOfficialRenderSpec(body?.officialModel, body?.size, env);
  const passkey = body?.passkey;
  const deduction = await deductWalletCredits(env, passkey, spec.cost, clientIp);
  if (!deduction.ok) {
    const err = new Error(
      `当前通行证剩余点数不足（${spec.modelLabel} ${spec.sizeLabel} 需要 ${spec.cost} 点，当前剩余 ${deduction.wallet.credits} 点）。请充值点数、切换更省点模式，或使用「自带 API」。`
    );
    err.code = "INSUFFICIENT_CREDITS";
    err.wallet = deduction.wallet;
    throw err;
  }

  const effectiveBg = spec.supportsTransparent ? background : "auto";
  const effectiveFormat = spec.supportsTransparent ? outputFormat : undefined;

  try {
    const result = await callVolcengineSeedream({
      apiKey: officialApiKey,
      baseUrl: (env && env.ARK_BASE_URL) || DEFAULT_ARK_BASE_URL,
      model: spec.modelId,
      prompt: finalPrompt,
      images: finalImages,
      size: spec.size,
      background: effectiveBg,
      outputFormat: effectiveFormat,
    });

    return {
      ok: true,
      channel: "official",
      imageDataUrl: result.imageDataUrl,
      modelUsed: result.modelUsed,
      officialModelUsed: spec.key,
      styleRefApplied: styleRefAttached,
      sizeUsed: spec.size,
      costCredits: spec.cost,
      wallet: deduction.wallet,
    };
  } catch (renderErr) {
    // Upstream failed -> refund deducted credits immediately so user never loses points!
    const refundedWallet = await refundWalletCredits(env, passkey, spec.cost);
    renderErr.wallet = refundedWallet || deduction.wallet;
    throw renderErr;
  }
}
